import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { User } from './models.js';

export type UserRole = 'owner' | 'cashier';

export type AuthedUser = {
  id: string;
  username: string;
  role: UserRole;
};

type JwtPayload = {
  sub: string;
  username: string;
  role: UserRole;
};

export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error('JWT_SECRET is not set');
  }
  return s;
}

export function signToken(user: AuthedUser): string {
  const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' });
}

export function readTokenFromReq(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice('bearer '.length).trim();
  }
  // allow token in query string for PDF links
  const q = req.query?.token;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return null;
}

export function verifyToken(token: string): AuthedUser {
  const decoded = jwt.verify(token, getJwtSecret()) as any;
  return {
    id: String(decoded.sub),
    username: String(decoded.username),
    role: decoded.role as UserRole
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, password_hash: string): Promise<boolean> {
  return await bcrypt.compare(password, password_hash);
}

export async function findUserByUsername(username: string) {
  const u = await User.findOne({ username }).lean();
  if (!u) return null;
  return { id: String(u._id), username: String(u.username), role: u.role as UserRole, password_hash: String(u.password_hash) };
}



