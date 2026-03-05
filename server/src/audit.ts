import type { Request } from 'express';
import mongoose from 'mongoose';
import { AuditLog } from './models.js';
import type { AuthedUser } from './auth.js';

export async function audit(
  req: Request,
  user: AuthedUser | null,
  action: string,
  entity: string,
  entity_id?: string,
  meta?: any
) {
  try {
    await AuditLog.create({
      at: new Date(),
      user_id: user?.id ? new mongoose.Types.ObjectId(user.id) : undefined,
      username: user?.username,
      role: user?.role,
      action,
      entity,
      entity_id,
      meta,
      ip: req.ip,
      user_agent: String(req.headers['user-agent'] ?? '')
    });
  } catch {
    // best-effort; never block the request
  }
}



