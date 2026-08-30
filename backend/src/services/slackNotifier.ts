import { WebClient } from '@slack/web-api';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Send a Slack notification when a sender's hourly rate limit is reached.
 * Gracefully handles disconnected state — no crash if Slack is not connected.
 */
export async function notifyRateLimitHit(
  userId: string,
  senderEmail: string,
  currentCount: number,
  maxLimit: number
): Promise<void> {
  try {
    const slackConnection = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    // If no Slack connection, silently skip
    if (!slackConnection || !slackConnection.isActive) {
      console.log(
        `ℹ️ No active Slack connection for user ${userId}, skipping notification`
      );
      return;
    }

    // Use webhook URL if available, otherwise use Web API
    if (slackConnection.webhookUrl) {
      // Send via incoming webhook
      const response = await fetch(slackConnection.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `⚠️ *Rate Limit Reached* for sender \`${senderEmail}\``,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '⚠️ Email Rate Limit Reached',
                emoji: true,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Sender:*\n${senderEmail}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Current Count:*\n${currentCount}/${maxLimit} emails/hour`,
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '📋 Excess emails have been automatically rescheduled to the next available hour window. No emails will be dropped.',
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `_Sent by ReachInbox Email Scheduler at ${new Date().toISOString()}_`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        console.error(`Slack webhook failed: ${response.status}`);
      } else {
        console.log(`✅ Slack notification sent for rate limit on ${senderEmail}`);
      }
    } else if (slackConnection.accessToken && slackConnection.channelId) {
      // Send via Slack Web API
      const client = new WebClient(slackConnection.accessToken);
      await client.chat.postMessage({
        channel: slackConnection.channelId,
        text: `⚠️ Rate Limit Reached for sender ${senderEmail}: ${currentCount}/${maxLimit} emails/hour. Excess emails rescheduled.`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚠️ Email Rate Limit Reached',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Sender:*\n${senderEmail}`,
              },
              {
                type: 'mrkdwn',
                text: `*Current Count:*\n${currentCount}/${maxLimit} emails/hour`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '📋 Excess emails have been automatically rescheduled to the next available hour window.',
            },
          },
        ],
      });

      console.log(`✅ Slack message sent for rate limit on ${senderEmail}`);
    }
  } catch (error) {
    // Non-fatal — log and continue
    console.error('⚠️ Slack notification failed (non-fatal):', error);
  }
}
