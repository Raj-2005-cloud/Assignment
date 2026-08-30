import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { createRedisConnection } from '../config/redis';
import { config } from '../config';
import { EmailJobData, addEmailJob } from './emailQueue';
import { checkRateLimit } from '../services/rateLimiter';
import { indexEmail } from '../services/elasticsearch';
import { notifyRateLimitHit } from '../services/slackNotifier';

const prisma = new PrismaClient();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const {
    emailJobId,
    senderId,
    userId,
    recipientEmail,
    subject,
    body,
    senderEmail,
    etherealUser,
    etherealPass,
    idempotencyKey,
  } = job.data;

  console.log(`📧 Processing job ${job.id} → ${recipientEmail}`);

  // 1. Idempotency check — if already SENT, skip
  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
  });

  if (!emailJob) {
    console.log(`⚠️ Email job ${emailJobId} not found in DB, skipping`);
    return;
  }

  if (emailJob.status === 'SENT') {
    console.log(`✅ Email ${emailJobId} already sent, skipping (idempotent)`);
    return;
  }

  // 2. Rate limit check
  const rateLimitResult = await checkRateLimit(senderId);

  if (!rateLimitResult.allowed) {
    console.log(
      `⏳ Rate limit hit for sender ${senderId}: ${rateLimitResult.currentCount}/${rateLimitResult.limit}. Rescheduling...`
    );

    // Update status to RATE_LIMITED
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: 'RATE_LIMITED' },
    });

    // Reschedule to next hour window
    const newJobData: EmailJobData = { ...job.data };
    try {
      // Remove idempotency constraint for rescheduled job by appending retry suffix
      const retryKey = `${idempotencyKey}:retry:${Date.now()}`;
      newJobData.idempotencyKey = retryKey;
      await addEmailJob(newJobData, rateLimitResult.retryAfterMs + 1000);
    } catch (err) {
      // If job already exists, that's fine — idempotency working
      console.log(`Job reschedule handled: ${(err as Error).message}`);
    }

    // Update DB with new scheduled time
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'SCHEDULED',
        scheduledAt: rateLimitResult.resetAt,
        bullJobId: newJobData.idempotencyKey,
      },
    });

    // Send Slack notification
    await notifyRateLimitHit(
      userId,
      senderEmail,
      rateLimitResult.currentCount,
      rateLimitResult.limit
    );

    return;
  }

  // 3. Update status to SENDING
  await prisma.emailJob.update({
    where: { id: emailJobId },
    data: { status: 'SENDING' },
  });

  try {
    // 4. Create transport with sender's Ethereal credentials
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: etherealUser,
        pass: etherealPass,
      },
    });

    // 5. Send email
    const info = await transporter.sendMail({
      from: `"${senderEmail}" <${etherealUser}>`,
      to: recipientEmail,
      subject: subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>${subject}</h2>
        <div>${body.replace(/\n/g, '<br>')}</div>
        <hr style="margin-top: 20px;">
        <p style="color: #888; font-size: 12px;">Sent via ReachInbox Email Scheduler</p>
      </div>`,
    });

    // 6. Get preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);

    // 7. Update DB: SENT
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        etherealPreviewUrl: previewUrl ? String(previewUrl) : null,
      },
    });

    // 8. Index in Elasticsearch
    await indexEmail({
      id: emailJobId,
      userId,
      senderId,
      recipientEmail,
      subject,
      body,
      status: 'SENT',
      scheduledAt: emailJob.scheduledAt,
      sentAt: new Date(),
      senderEmail,
      batchId: emailJob.batchId,
      createdAt: emailJob.createdAt,
    });

    console.log(`✅ Email sent to ${recipientEmail} | Preview: ${previewUrl}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Update DB: FAILED
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });

    console.error(`❌ Failed to send email to ${recipientEmail}:`, errorMessage);
    throw error; // Let BullMQ retry
  }

  // 9. Apply delay between sends
  if (config.MIN_DELAY_BETWEEN_EMAILS_MS > 0) {
    await sleep(config.MIN_DELAY_BETWEEN_EMAILS_MS);
  }
}

let emailWorker: Worker | null = null;

export function startEmailWorker(): Worker {
  if (emailWorker) {
    return emailWorker;
  }

  emailWorker = new Worker<EmailJobData>(
    'email-send',
    processEmailJob,
    {
      connection: createRedisConnection(),
      concurrency: config.WORKER_CONCURRENCY,
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second at queue level
      },
    }
  );

  emailWorker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });

  emailWorker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(
    `✅ Email worker started (concurrency: ${config.WORKER_CONCURRENCY})`
  );

  return emailWorker;
}
