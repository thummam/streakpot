import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { currentUser, requireAuth, signToken } from '../auth.js';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError, parse } from '../http.js';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 20 : 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

const email = z.string().trim().toLowerCase().email('enter a valid email').max(254);

const signupSchema = z.object({
  name: z.string().trim().min(1, 'required').max(40),
  email,
  password: z.string().min(8, 'must be at least 8 characters').max(200),
});

const loginSchema = z.object({ email, password: z.string().min(1, 'required') });

type UserRow = { id: number; name: string; email: string; password_hash: string };

authRouter.post('/signup', limiter, async (req, res) => {
  const body = parse(signupSchema, req.body);
  const hash = await bcrypt.hash(body.password, 10);
  const rows = await query<UserRow>(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING RETURNING id, name, email`,
    [body.name, body.email, hash],
  );
  if (!rows[0]) throw new HttpError(409, 'An account with that email already exists.');
  const user = rows[0];
  res.status(201).json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email } });
});

authRouter.post('/login', limiter, async (req, res) => {
  const body = parse(loginSchema, req.body);
  const [user] = await query<UserRow>('SELECT * FROM users WHERE email = $1', [body.email]);
  if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
    throw new HttpError(401, 'Wrong email or password.');
  }
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email } });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const [user] = await query('SELECT id, name, email FROM users WHERE id = $1', [currentUser(req).id]);
  if (!user) throw new HttpError(401, 'Please log in.');
  res.json({ user });
});
