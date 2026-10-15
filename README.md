# StreakPot

**Group habit challenges with stakes.** Start a challenge with friends ("gym 3× a week for 4 weeks"), check in with photo proof, and let your friends vote on whether it's legit. Miss your weekly target and you pay points into the pot. Everyone who never misses splits it at the end.

**Live:** https://YOUR-APP.vercel.app  ·  **API:** https://YOUR-API.onrender.com/api/health

<!-- Add a screenshot or GIF here: docs/screenshot.png -->

## Features

- **Accounts:** email/password sign-up, bcrypt-hashed passwords, JWT auth, rate-limited login
- **Challenges (CRUD):** create, view, rename, and delete challenges; set the weekly target, length, and points at stake
- **Invite links:** a shareable `/join/:code` page that works before you sign up and drops you into the challenge afterwards
- **Photo check-ins:** images are compressed in the browser, stored privately, and visible only to challenge members
- **Peer verification:** members vote *Legit 👍* or *Cap 🧢* on each check-in. A strict majority of no votes rejects it, half or more yes votes approve it, and anything still undecided is auto-approved after 48h
- **Weekly settlement and pot:** a live leaderboard with week-by-week results, streaks, the pot size, and projected payouts
- **Responsive UI** with automatic dark mode

## Tech stack

| Layer    | Tech |
|----------|------|
| Frontend | React 19, TypeScript, React Router, Vite (hosted on **Vercel**) |
| Backend  | Node.js, Express 5, TypeScript, Zod validation, Helmet, rate limiting (hosted on **Render**) |
| Database | PostgreSQL with hand-written SQL migrations and the `pg` driver (hosted on **Neon**) |
| Testing  | Vitest unit tests for the scoring engine, plus Supertest end-to-end API tests against a real Postgres |
| CI       | GitHub Actions: typecheck, tests against a Postgres service container, and the frontend build |

## Architecture and design decisions

```
React SPA (Vercel) ──HTTPS/JSON + Bearer JWT──▶ Express API (Render) ──SQL──▶ Postgres (Neon)
```

- **Standings are derived data, not stored state.** Check-in status, weekly results, streaks, and the pot are all computed by one pure function ([`server/src/scoring.ts`](server/src/scoring.ts)) from the raw rows: check-ins, votes, and memberships. There is no cron job that can fail halfway, and no counter that can drift out of sync. Because the function is pure, it's easy to unit-test exhaustively.
- **Fair settlement:** a week only "settles" 2 days after it ends, so late votes can still land. People who join mid-challenge aren't penalised for weeks they weren't in.
- **Time zones:** calendar days are stored as `DATE` and handled as `YYYY-MM-DD` strings end to end. The API accepts check-ins for the server date ±1 day, so every time zone can log "today."
- **Authorization at the query level:** every challenge or check-in query joins on `memberships` for the current user, so a non-member gets a 404 and can't tell whether the resource exists.
- **Photos live in Postgres (`BYTEA`):** they're downscaled to ≤1080px JPEG in the browser first, typically 100–200 KB. This keeps the stack to a single managed service. Moving them to S3/R2 is the next step at scale.

## API

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` · `/api/auth/login` | Returns `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| GET / POST | `/api/challenges` | List my challenges with summaries / create one |
| GET / PATCH / DELETE | `/api/challenges/:id` | Full state with standings / rename (owner) / delete (owner) |
| DELETE | `/api/challenges/:id/membership` | Leave a challenge |
| POST | `/api/challenges/:id/checkins` | Check in `{ day, note, photo? }` |
| PUT | `/api/checkins/:id/vote` | `{ approve: boolean }` |
| GET | `/api/checkins/:id/photo` | Photo (members only) |
| DELETE | `/api/checkins/:id` | Delete my check-in |
| GET / POST | `/api/invites/:code` · `/api/invites/:code/join` | Preview an invite / join |

## Run it locally

Requires Node 20+. No Postgres install is needed: `db:local` runs a real Postgres server from npm.

```bash
# terminal 1 — database
cd server && npm install && npm run db:local

# terminal 2 — API on :4000 (runs migrations on start)
cd server && npm run dev

# terminal 3 — web on :5173 (proxies /api to :4000)
cd web && npm install && npm run dev
```

Tests:

```bash
cd server && TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/streakpot_test npm test
```

## Deploy (free tier)

1. **Database: [Neon](https://neon.tech).** Create a project and copy the connection string (`postgres://…?sslmode=require`).
2. **API: [Render](https://render.com).** Choose New → Blueprint, pick this repo (it reads `render.yaml`), then set `DATABASE_URL` to the Neon string. `JWT_SECRET` is generated automatically. Migrations run on boot.
3. **Web: [Vercel](https://vercel.com).** Choose New Project, set Root Directory to `web`, and add the environment variable `VITE_API_URL=https://<your-render-app>.onrender.com`. Deploy.
4. Back on Render, set `CORS_ORIGIN=https://<your-vercel-app>.vercel.app` (comma-separate multiple origins).

> Render's free tier sleeps after 15 minutes idle, so the first request then takes about 30–50 seconds. A free [UptimeRobot](https://uptimerobot.com) monitor pinging `/api/health` every 10 minutes keeps it awake.

## Usage

```sql
-- quick stats for your resume
SELECT (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM challenges) AS challenges,
       (SELECT COUNT(*) FROM check_ins) AS check_ins,
       (SELECT COUNT(*) FROM votes) AS votes;
```
