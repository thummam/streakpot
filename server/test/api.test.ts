// End-to-end API test against a real Postgres database.
// Requires TEST_DATABASE_URL (npm run db:local creates `streakpot_test`).
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dbUrl = process.env.TEST_DATABASE_URL;
const today = new Date().toISOString().slice(0, 10);

describe.skipIf(!dbUrl)('API', () => {
  let app: Parameters<typeof request>[0];
  let pool: import('pg').Pool;

  beforeAll(async () => {
    process.env.DATABASE_URL = dbUrl;
    const db = await import('../src/db.js');
    pool = db.pool;
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await (await import('../src/migrate.js')).migrate(() => {});
    app = (await import('../src/app.js')).createApp();
  });

  afterAll(async () => pool?.end());

  async function signup(name: string) {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name, email: `${name.toLowerCase()}@example.com`, password: 'password123' })
      .expect(201);
    return res.body.token as string;
  }

  it('runs a full challenge flow', async () => {
    const ana = await signup('Ana');
    const ben = await signup('Ben');
    const cy = await signup('Cy');

    await request(app).post('/api/auth/login').send({ email: 'ana@example.com', password: 'nope' }).expect(401);
    await request(app).get('/api/challenges').expect(401);

    const created = await request(app)
      .post('/api/challenges')
      .set('Authorization', `Bearer ${ana}`)
      .send({ title: 'Gym 3x a week', targetPerWeek: 3, stake: 50, weeks: 4, startDate: today })
      .expect(201);
    const { id, inviteCode } = created.body.challenge;

    // Non-members can't see it.
    await request(app).get(`/api/challenges/${id}`).set('Authorization', `Bearer ${ben}`).expect(404);

    const preview = await request(app).get(`/api/invites/${inviteCode}`).expect(200);
    expect(preview.body.challenge.title).toBe('Gym 3x a week');

    for (const token of [ben, cy]) {
      await request(app).post(`/api/invites/${inviteCode}/join`).set('Authorization', `Bearer ${token}`).expect(200);
    }

    const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const ci = await request(app)
      .post(`/api/challenges/${id}/checkins`)
      .set('Authorization', `Bearer ${ana}`)
      .send({ day: today, note: 'Leg day', photo })
      .expect(201);

    await request(app)
      .post(`/api/challenges/${id}/checkins`)
      .set('Authorization', `Bearer ${ana}`)
      .send({ day: today, note: 'again' })
      .expect(409);

    await request(app).put(`/api/checkins/${ci.body.id}/vote`).set('Authorization', `Bearer ${ana}`).send({ approve: true }).expect(403);

    let state = await request(app).get(`/api/challenges/${id}`).set('Authorization', `Bearer ${ben}`).expect(200);
    expect(state.body.checkIns[0].status).toBe('pending');

    await request(app).put(`/api/checkins/${ci.body.id}/vote`).set('Authorization', `Bearer ${ben}`).send({ approve: true }).expect(204);
    state = await request(app).get(`/api/challenges/${id}`).set('Authorization', `Bearer ${ben}`).expect(200);
    expect(state.body.checkIns[0].status).toBe('approved');
    expect(state.body.checkIns[0].myVote).toBe(true);
    expect(state.body.standings).toHaveLength(3);

    const img = await request(app).get(`/api/checkins/${ci.body.id}/photo`).set('Authorization', `Bearer ${cy}`).expect(200);
    expect(img.headers['content-type']).toBe('image/png');

    const list = await request(app).get('/api/challenges').set('Authorization', `Bearer ${ana}`).expect(200);
    expect(list.body.challenges[0].me.thisWeek.approved).toBe(1);

    await request(app).delete(`/api/challenges/${id}`).set('Authorization', `Bearer ${ben}`).expect(404);
    await request(app).delete(`/api/challenges/${id}/membership`).set('Authorization', `Bearer ${cy}`).expect(204);
    await request(app).delete(`/api/challenges/${id}`).set('Authorization', `Bearer ${ana}`).expect(204);
  });

  it('validates input', async () => {
    const res = await request(app).post('/api/auth/signup').send({ name: 'X', email: 'bad', password: 'short' }).expect(400);
    expect(res.body.error).toMatch(/email/);
  });
});
