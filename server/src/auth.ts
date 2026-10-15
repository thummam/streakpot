import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { HttpError } from './http.js';

export interface AuthUser {
  id: number;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ name: user.name }, config.jwtSecret, { subject: String(user.id), expiresIn: '30d' });
}

function readUser(req: Request): AuthUser | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
    return { id: Number(payload.sub), name: String(payload.name) };
  } catch {
    return undefined;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = readUser(req);
  if (!user) return next(new HttpError(401, 'Please log in.'));
  req.user = user;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = readUser(req);
  next();
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'Please log in.');
  return req.user;
}
