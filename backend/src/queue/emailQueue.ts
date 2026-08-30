import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis';

let emailQueue: Queue | null = null;

export interface EmailJobData {
  emailJobId: string;
  senderId: string;
  userId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  senderEmail: string;
  etherealUser: string;
  etherealPass: string;
  idempotencyKey: string;
}

export function getEmailQueue(): Queue {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>('email-send', {
      connection: createRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    console.log('✅ BullMQ email queue initialized');
  }
  return emailQueue;
}

export async function addEmailJob(
  data: EmailJobData,
  delayMs: number
): Promise<string> {
  const queue = getEmailQueue();

  const job = await queue.add('send-email', data, {
    delay: Math.max(0, delayMs),
    jobId: data.idempotencyKey, // Prevents duplicate jobs
  });

  return job.id || data.idempotencyKey;
}
