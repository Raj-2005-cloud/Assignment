import { PrismaClient } from '@prisma/client';
import { addEmailJob, EmailJobData } from './emailQueue';
import { getEmailQueue } from './emailQueue';

const prisma = new PrismaClient();

/**
 * Restart Recovery:
 * On server startup, this function queries all emails with status
 * SCHEDULED/QUEUED/RATE_LIMITED where scheduledAt is in the future.
 * For each, it checks if a BullMQ job already exists. If not,
 * it re-creates the delayed job in BullMQ.
 *
 * This ensures NO emails are lost on server restart and NO duplicates
 * are created (idempotencyKey = BullMQ jobId prevents duplicates).
 */
export async function recoverPendingJobs(): Promise<void> {
  console.log('🔄 Starting job recovery sweep...');

  const now = new Date();

  // Find all pending jobs that should still be scheduled
  const pendingJobs = await prisma.emailJob.findMany({
    where: {
      status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED'] },
      scheduledAt: { gt: now },
    },
    include: {
      sender: true,
    },
  });

  if (pendingJobs.length === 0) {
    console.log('✅ No pending jobs to recover');
    return;
  }

  console.log(`📋 Found ${pendingJobs.length} pending jobs to verify`);

  const queue = getEmailQueue();
  let recovered = 0;
  let alreadyQueued = 0;

  for (const emailJob of pendingJobs) {
    try {
      // Check if BullMQ job already exists
      const existingJob = await queue.getJob(emailJob.idempotencyKey);

      if (existingJob) {
        alreadyQueued++;
        continue;
      }

      // Re-create the delayed job
      const delayMs = emailJob.scheduledAt.getTime() - Date.now();

      if (delayMs <= 0) {
        // Job should have already fired — queue it immediately
        const jobData: EmailJobData = {
          emailJobId: emailJob.id,
          senderId: emailJob.senderId,
          userId: emailJob.userId,
          recipientEmail: emailJob.recipientEmail,
          subject: emailJob.subject,
          body: emailJob.body,
          senderEmail: emailJob.sender.email,
          etherealUser: emailJob.sender.etherealUser,
          etherealPass: emailJob.sender.etherealPass,
          idempotencyKey: emailJob.idempotencyKey,
        };

        await addEmailJob(jobData, 0);
      } else {
        const jobData: EmailJobData = {
          emailJobId: emailJob.id,
          senderId: emailJob.senderId,
          userId: emailJob.userId,
          recipientEmail: emailJob.recipientEmail,
          subject: emailJob.subject,
          body: emailJob.body,
          senderEmail: emailJob.sender.email,
          etherealUser: emailJob.sender.etherealUser,
          etherealPass: emailJob.sender.etherealPass,
          idempotencyKey: emailJob.idempotencyKey,
        };

        await addEmailJob(jobData, delayMs);
      }

      // Update status back to SCHEDULED
      await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { status: 'SCHEDULED' },
      });

      recovered++;
    } catch (error) {
      // Job might already exist (idempotency) — that's fine
      const errMsg = (error as Error).message;
      if (!errMsg.includes('already exists')) {
        console.error(`⚠️ Failed to recover job ${emailJob.id}:`, errMsg);
      } else {
        alreadyQueued++;
      }
    }
  }

  console.log(
    `✅ Recovery complete: ${recovered} recovered, ${alreadyQueued} already queued`
  );
}

/**
 * Also recover jobs that should have been sent in the past
 * (server was down during their scheduled time).
 */
export async function recoverPastDueJobs(): Promise<void> {
  const now = new Date();

  const pastDueJobs = await prisma.emailJob.findMany({
    where: {
      status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED'] },
      scheduledAt: { lte: now },
    },
    include: {
      sender: true,
    },
  });

  if (pastDueJobs.length === 0) {
    return;
  }

  console.log(`📋 Found ${pastDueJobs.length} past-due jobs to process`);

  for (const emailJob of pastDueJobs) {
    try {
      const jobData: EmailJobData = {
        emailJobId: emailJob.id,
        senderId: emailJob.senderId,
        userId: emailJob.userId,
        recipientEmail: emailJob.recipientEmail,
        subject: emailJob.subject,
        body: emailJob.body,
        senderEmail: emailJob.sender.email,
        etherealUser: emailJob.sender.etherealUser,
        etherealPass: emailJob.sender.etherealPass,
        idempotencyKey: emailJob.idempotencyKey,
      };

      // Queue immediately with slight stagger to avoid thundering herd
      const staggerMs = Math.random() * 5000;
      await addEmailJob(jobData, staggerMs);

      await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { status: 'QUEUED' },
      });
    } catch (error) {
      // Already exists — fine
      const errMsg = (error as Error).message;
      if (!errMsg.includes('already exists')) {
        console.error(`⚠️ Failed to recover past-due job ${emailJob.id}:`, errMsg);
      }
    }
  }
}
