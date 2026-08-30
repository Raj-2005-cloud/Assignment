import { Router, Request, Response } from 'express';
import passport from 'passport';
import { generateToken, authMiddleware, AuthUser } from '../auth/middleware';
import { config } from '../config';

const router = Router();

// Initiate Google OAuth
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed`,
  }),
  (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const token = generateToken(user);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${config.FRONTEND_URL}/dashboard#token=${token}`);
  }
);

// Dev / Demo login (creates or logs into demo user)
router.get('/dev-login', async (_req: Request, res: Response) => {
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

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${config.FRONTEND_URL}/dashboard#token=${token}`);
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
