import type { NextFunction, Request, Response } from 'express';
import { readTokenFromReq, verifyToken } from '../auth.js';
import type { UserRole } from '../auth.js';

export type RequestWithUser = Request & { user?: { id: string; username: string; role: UserRole } };

export function requireAuth(req: RequestWithUser, res: Response, next: NextFunction) {
  const token = readTokenFromReq(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}



