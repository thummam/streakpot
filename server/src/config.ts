function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', isProd ? undefined : 'postgres://postgres:postgres@localhost:5433/streakpot'),
  jwtSecret: required('JWT_SECRET', isProd ? undefined : 'dev-only-secret-change-me'),
  // Comma-separated list of allowed front-end origins.
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean),
  isProd,
};
