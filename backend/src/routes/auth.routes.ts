import { Router, Request, Response } from 'express';
import passport from 'passport';
import { generateToken, authMiddleware, AuthUser } from '../auth/middleware';
import { config } from '../config';

const router = Router();

const isGoogleAuthConfigured = () => {
  return !!(
    config.GOOGLE_CLIENT_ID &&
    config.GOOGLE_CLIENT_SECRET &&
    config.GOOGLE_CLIENT_ID !== 'your_google_client_id' &&
    config.GOOGLE_CLIENT_ID.trim() !== ''
  );
};

// Initiate Google OAuth (falls back gracefully to dev-login if keys aren't provided)
router.get('/google', (req: Request, res: Response, next) => {
  if (!isGoogleAuthConfigured()) {
    console.log('ℹ️ Google OAuth credentials not provided. Redirecting to dev-login');
    return res.redirect('/api/auth/dev-login');
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
    session: false,
  })(req, res, next);
});

const getFrontendUrl = (req: Request): string => {
  const forwardedProto = req.headers['x-forwarded-proto'] as string;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (host && !host.includes('localhost')) {
    const proto = forwardedProto || 'https';
    return `${proto}://${host}`;
  }
  return config.FRONTEND_URL || 'http://localhost:5173';
};

// Google OAuth callback
router.get(
  '/google/callback',
  (req: Request, res: Response, next) => {
    const frontendBase = getFrontendUrl(req);
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${frontendBase}/login?error=auth_failed`,
    })(req, res, next);
  },
  (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const token = generateToken(user);
    const frontendBase = getFrontendUrl(req);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${frontendBase}/dashboard#token=${token}`);
  }
);

// Dev / Demo login (creates or logs into demo user)
router.get('/dev-login', async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    let demoUser = await prisma.user.findFirst({
      where: { email: 'demo.user@reachinbox.ai' },
    });

    if (!demoUser) {
      demoUser = await prisma.user.create({
        data: {
          googleId: 'demo-google-id-12345',
          email: 'demo.user@reachinbox.ai',
          name: 'Demo Candidate',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
        },
      });
    }

    const token = generateToken(demoUser);
    const isProd = process.env.NODE_ENV === 'production';
    const frontendBase = getFrontendUrl(req);

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${frontendBase}/dashboard#token=${token}`);
  } catch (error) {
    console.error('Dev login error:', error);
    res.status(500).json({ error: 'Dev login failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

export default router;
