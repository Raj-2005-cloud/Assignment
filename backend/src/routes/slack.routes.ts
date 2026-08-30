import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../auth/middleware';
import { config } from '../config';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/slack/connect
 * Redirect to Slack OAuth authorize URL
 */
router.get('/connect', authMiddleware, (req: Request, res: Response) => {
  if (!config.SLACK_CLIENT_ID) {
    res.status(503).json({ error: 'Slack integration not configured' });
    return;
  }

  const state = Buffer.from(
    JSON.stringify({ userId: req.user!.id })
  ).toString('base64');

  const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackAuthUrl.searchParams.set('client_id', config.SLACK_CLIENT_ID);
  slackAuthUrl.searchParams.set('scope', 'incoming-webhook,chat:write');
  slackAuthUrl.searchParams.set('redirect_uri', config.SLACK_REDIRECT_URI);
  slackAuthUrl.searchParams.set('state', state);

  res.json({ url: slackAuthUrl.toString() });
});

/**
 * GET /api/slack/callback
 * Handle Slack OAuth callback
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      res.redirect(`${config.FRONTEND_URL}/dashboard?slack=error`);
      return;
    }

    // Decode state to get userId
    const { userId } = JSON.parse(
      Buffer.from(state as string, 'base64').toString('utf-8')
    );

    // Exchange code for token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.SLACK_CLIENT_ID,
        client_secret: config.SLACK_CLIENT_SECRET,
        code: code as string,
        redirect_uri: config.SLACK_REDIRECT_URI,
      }),
    });

    const tokenData = (await tokenResponse.json()) as any;

    if (!tokenData.ok) {
      console.error('Slack OAuth error:', tokenData.error);
      res.redirect(`${config.FRONTEND_URL}/dashboard?slack=error`);
      return;
    }

    // Store/update Slack connection
    await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        accessToken: tokenData.access_token || '',
        webhookUrl: tokenData.incoming_webhook?.url || null,
        channelId: tokenData.incoming_webhook?.channel_id || null,
        teamName: tokenData.team?.name || null,
        isActive: true,
      },
      create: {
        userId,
        accessToken: tokenData.access_token || '',
        webhookUrl: tokenData.incoming_webhook?.url || null,
        channelId: tokenData.incoming_webhook?.channel_id || null,
        teamName: tokenData.team?.name || null,
        isActive: true,
      },
    });

    console.log(`✅ Slack connected for user ${userId}`);
    res.redirect(`${config.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (error) {
    console.error('Slack callback error:', error);
    res.redirect(`${config.FRONTEND_URL}/dashboard?slack=error`);
  }
});

/**
 * GET /api/slack/status
 * Get Slack connection status for current user
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    res.json({
      connected: connection?.isActive || false,
      teamName: connection?.teamName || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check Slack status' });
  }
});

/**
 * POST /api/slack/disconnect
 * Disconnect Slack for current user
 */
router.post('/disconnect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.slackConnection.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    res.json({ message: 'Slack disconnected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
});

export default router;
