import { Router, Request, Response } from 'express';
import { db } from '../db/database.ts';
import { notificationService } from '../services/notificationService.ts';
import {
  authenticateToken,
  AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

// GET /api/v1/notifications (User's in-app notifications)
router.get(
  '/',
  authenticateToken,
  (req: AuthenticatedRequest, res: Response): void => {
    const list = db.notifications.filter((n) => n.userId === req.user?.id);
    const unreadCount = list.filter((n) => !n.isRead).length;

    res.json({
      total: list.length,
      unreadCount,
      notifications: list,
    });
  }
);

// PATCH /api/v1/notifications/:notificationId/read
router.patch(
  '/:notificationId/read',
  authenticateToken,
  (req: AuthenticatedRequest, res: Response): void => {
    const { notificationId } = req.params;
    const notif = db.notifications.find(
      (n) => n.id === notificationId && n.userId === req.user?.id
    );

    if (!notif) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    notif.isRead = true;
    db.persist();

    res.json({ message: 'Notification marked as read', notification: notif });
  }
);

// POST /api/v1/notifications/read-all
router.post(
  '/read-all',
  authenticateToken,
  (req: AuthenticatedRequest, res: Response): void => {
    const userNotifs = db.notifications.filter((n) => n.userId === req.user?.id);
    userNotifs.forEach((n) => {
      n.isRead = true;
    });
    db.persist();

    res.json({ message: 'All notifications marked as read', updatedCount: userNotifs.length });
  }
);

// GET /api/v1/notifications/stream (Server-Sent Events for real-time notification stream)
router.get('/stream', (req: Request, res: Response): void => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: 'userId is required for SSE connection' });
    return;
  }
  notificationService.addClient(userId, res);
});

export default router;
