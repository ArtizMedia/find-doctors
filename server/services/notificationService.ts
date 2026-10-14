import { Response } from 'express';
import { db } from '../db/database.ts';
import { NotificationItem, NotificationType, UserRole } from '../db/schema.ts';

interface SSEClient {
  userId: string;
  res: Response;
}

class NotificationService {
  private sseClients: SSEClient[] = [];

  public addClient(userId: string, res: Response): void {
    const client: SSEClient = { userId, res };
    this.sseClients.push(client);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE stream established' })}\n\n`);

    res.on('close', () => {
      this.sseClients = this.sseClients.filter((c) => c !== client);
    });
  }

  public notifyUser(
    userId: string,
    role: UserRole,
    title: string,
    message: string,
    type: NotificationType,
    appointmentId?: string
  ): NotificationItem {
    const notif: NotificationItem = {
      id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      userId,
      role,
      title,
      message,
      type,
      appointmentId,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    db.notifications.unshift(notif);
    db.persist();

    // Broadcast through SSE to active listeners for this user
    this.broadcastToUser(userId, {
      event: 'NOTIFICATION',
      data: notif,
    });

    return notif;
  }

  public broadcastToUser(userId: string, payload: { event: string; data: unknown }): void {
    const targets = this.sseClients.filter((c) => c.userId === userId);
    for (const client of targets) {
      try {
        client.res.write(`event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`);
      } catch (err) {
        console.error('Error sending SSE message:', err);
      }
    }
  }

  public broadcastToRole(role: UserRole, payload: { event: string; data: unknown }): void {
    const userIds = db.users.filter((u) => u.role === role).map((u) => u.id);
    for (const uid of userIds) {
      this.broadcastToUser(uid, payload);
    }
  }

  public broadcastAll(payload: { event: string; data: unknown }): void {
    for (const client of this.sseClients) {
      try {
        client.res.write(`event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`);
      } catch (err) {
        console.error('Error broadcasting SSE message:', err);
      }
    }
  }
}

export const notificationService = new NotificationService();
