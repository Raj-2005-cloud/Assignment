import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { authMiddleware } from '../auth/middleware';

const prisma = new PrismaClient();
const router = Router();

router.use(authMiddleware);

/**
 * GET /api/senders
 * List all senders for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const senders = await prisma.sender.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ senders });
  } catch (error) {
    console.error('List senders error:', error);
    res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

/**
 * POST /api/senders
 * Create a new sender with auto-generated Ethereal credentials
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { email, displayName } = req.body;

    if (!email || !displayName) {
      res.status(400).json({ error: 'Email and displayName are required' });
      return;
    }

    // Generate Ethereal test account for this sender
    const testAccount = await nodemailer.createTestAccount();

    const sender = await prisma.sender.create({
      data: {
        userId,
        email,
        displayName,
        etherealUser: testAccount.user,
        etherealPass: testAccount.pass,
      },
    });

    res.status(201).json({
      sender: {
        id: sender.id,
        email: sender.email,
        displayName: sender.displayName,
        etherealUser: sender.etherealUser,
        createdAt: sender.createdAt,
      },
    });
  } catch (error) {
    console.error('Create sender error:', error);
    res.status(500).json({ error: 'Failed to create sender' });
  }
});

/**
 * DELETE /api/senders/:id
 * Delete a sender
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;

    const sender = await prisma.sender.findFirst({
      where: { id, userId },
    });

    if (!sender) {
      res.status(404).json({ error: 'Sender not found' });
      return;
    }

    // Check if sender has pending jobs
    const pendingJobs = await prisma.emailJob.count({
      where: {
        senderId: id,
        status: { in: ['SCHEDULED', 'QUEUED', 'SENDING'] },
      },
    });

    if (pendingJobs > 0) {
      res.status(400).json({
        error: `Cannot delete sender with ${pendingJobs} pending email jobs`,
      });
      return;
    }

    await prisma.sender.delete({ where: { id } });

    res.json({ message: 'Sender deleted successfully' });
  } catch (error) {
    console.error('Delete sender error:', error);
    res.status(500).json({ error: 'Failed to delete sender' });
  }
});

export default router;
