import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../auth/middleware';
import { addEmailJob, EmailJobData } from '../queue/emailQueue';
import { searchEmails } from '../services/elasticsearch';
import { indexEmail } from '../services/elasticsearch';
import { getEmailQueue } from '../queue/emailQueue';

const prisma = new PrismaClient();
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require auth
router.use(authMiddleware);

/**
 * POST /api/emails/schedule
 * Schedule a batch of emails
 */
router.post(
  '/schedule',
  upload.single('csvFile'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const {
        subject,
        body,
        senderId,
        scheduledAt,
        recipients: recipientsJson,
        delayBetweenMs,
        maxPerHour,
      } = req.body;

      if (!subject || !body || !senderId || !scheduledAt) {
        res.status(400).json({
          error: 'Missing required fields: subject, body, senderId, scheduledAt',
        });
        return;
      }

      // Verify sender belongs to user
      const sender = await prisma.sender.findFirst({
        where: { id: senderId, userId },
      });

      if (!sender) {
        res.status(404).json({ error: 'Sender not found' });
        return;
      }

      // Parse recipients from CSV file or JSON body
      let recipients: string[] = [];

      if (req.file) {
        // Parse CSV
        const csvContent = req.file.buffer.toString('utf-8');
        const records = parse(csvContent, {
          columns: false,
          skip_empty_lines: true,
          trim: true,
        });

        // Extract emails — try first column, or look for email-like content
        for (const record of records) {
          const values = Array.isArray(record) ? record : Object.values(record);
          for (const val of values) {
            const trimmed = String(val).trim();
            if (trimmed.includes('@') && trimmed.includes('.')) {
              recipients.push(trimmed.toLowerCase());
            }
          }
        }
      } else if (recipientsJson) {
        recipients = JSON.parse(recipientsJson);
      }

      if (recipients.length === 0) {
        res.status(400).json({ error: 'No valid email recipients provided' });
        return;
      }

      // Deduplicate
      recipients = [...new Set(recipients)];

      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        // If scheduled in the past, schedule for 10 seconds from now
        scheduledDate.setTime(Date.now() + 10000);
      }

      const batchId = uuidv4();
      const delayBetween = parseInt(delayBetweenMs) || 0;
      const createdJobs: any[] = [];

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        // Generate idempotency key
        const idempotencyKey = crypto
          .createHash('sha256')
          .update(`${senderId}:${recipient}:${subject}:${scheduledDate.toISOString()}`)
          .digest('hex');

        // Check if already exists
        const existing = await prisma.emailJob.findUnique({
          where: { idempotencyKey },
        });

        if (existing) {
          createdJobs.push({ ...existing, skipped: true });
          continue;
        }

        // Calculate individual delay (stagger sends)
        const individualDelay = i * delayBetween;
        const jobScheduledAt = new Date(
          scheduledDate.getTime() + individualDelay
        );

        // Create DB record
        const emailJob = await prisma.emailJob.create({
          data: {
            userId,
            senderId,
            recipientEmail: recipient,
            subject,
            body,
            scheduledAt: jobScheduledAt,
            status: 'SCHEDULED',
            idempotencyKey,
            batchId,
            bullJobId: idempotencyKey,
          },
        });

        // Calculate BullMQ delay
        const delayMs = jobScheduledAt.getTime() - Date.now();

        // Create BullMQ job data
        const jobData: EmailJobData = {
          emailJobId: emailJob.id,
          senderId: sender.id,
          userId,
          recipientEmail: recipient,
          subject,
          body,
          senderEmail: sender.email,
          etherealUser: sender.etherealUser,
          etherealPass: sender.etherealPass,
          idempotencyKey,
        };

        try {
          const bullJobId = await addEmailJob(jobData, delayMs);
          await prisma.emailJob.update({
            where: { id: emailJob.id },
            data: { bullJobId, status: 'QUEUED' },
          });
        } catch (err) {
          // Job might already exist in BullMQ — that's fine
          console.log(`Job add handled: ${(err as Error).message}`);
        }

        createdJobs.push(emailJob);

        // Also index in Elasticsearch for searchability
        await indexEmail({
          id: emailJob.id,
          userId,
          senderId: sender.id,
          recipientEmail: recipient,
          subject,
          body,
          status: 'SCHEDULED',
          scheduledAt: jobScheduledAt,
          sentAt: null,
          senderEmail: sender.email,
          batchId,
          createdAt: emailJob.createdAt,
        });
      }

      res.status(201).json({
        message: `${createdJobs.length} emails scheduled successfully`,
        batchId,
        totalScheduled: createdJobs.length,
        jobs: createdJobs.map((j) => ({
          id: j.id,
          recipientEmail: j.recipientEmail,
          scheduledAt: j.scheduledAt,
          status: j.status,
          skipped: j.skipped || false,
        })),
      });
    } catch (error) {
      console.error('Schedule error:', error);
      res.status(500).json({ error: 'Failed to schedule emails' });
    }
  }
);

/**
 * GET /api/emails/scheduled
 * List scheduled emails for current user
 */
router.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: {
          userId,
          status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED'] },
        },
        include: { sender: { select: { email: true, displayName: true } } },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({
        where: {
          userId,
          status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED'] },
        },
      }),
    ]);

    res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List scheduled error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

/**
 * GET /api/emails/sent
 * List sent emails for current user
 */
router.get('/sent', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: {
          userId,
          status: { in: ['SENT', 'FAILED'] },
        },
        include: { sender: { select: { email: true, displayName: true } } },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({
        where: {
          userId,
          status: { in: ['SENT', 'FAILED'] },
        },
      }),
    ]);

    res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List sent error:', error);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

/**
 * GET /api/emails/search
 * Search emails via Elasticsearch
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const query = (req.query.q as string) || '';
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const results = await searchEmails(
      userId,
      query,
      { status },
      page,
      limit
    );

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * DELETE /api/emails/:id
 * Cancel a scheduled email
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;

    const emailJob = await prisma.emailJob.findFirst({
      where: { id, userId },
    });

    if (!emailJob) {
      res.status(404).json({ error: 'Email job not found' });
      return;
    }

    if (emailJob.status === 'SENT') {
      res.status(400).json({ error: 'Cannot cancel an already sent email' });
      return;
    }

    // Remove from BullMQ
    if (emailJob.bullJobId) {
      try {
        const queue = getEmailQueue();
        const job = await queue.getJob(emailJob.bullJobId);
        if (job) {
          await job.remove();
        }
      } catch (err) {
        console.error('Failed to remove BullMQ job:', err);
      }
    }

    // Delete from DB
    await prisma.emailJob.delete({ where: { id } });

    res.json({ message: 'Email cancelled successfully' });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel email' });
  }
});

export default router;
