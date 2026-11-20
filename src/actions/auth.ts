'use server';

import type { FormState } from 'src/types/common';

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

import { getDb } from 'src/server/db';
import { logger } from 'src/server/logger';
import { AppError } from 'src/server/errors';
import { clientIp } from 'src/server/http/request';
import { users, workspaces } from 'src/server/db/schema';
import { loginSchema, signupSchema } from 'src/server/validation';
import { createSession, destroySession } from 'src/server/auth/session';
import { rateLimit, PostgresRateLimitStore } from 'src/server/ratelimit';
import { DUMMY_HASH, hashPassword, verifyPassword } from 'src/server/auth/password';

import { invalid, formText } from './helpers';

// ----------------------------------------------------------------------

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Brute-force and sign-up spam protection. Counters are shared by every server instance. */
const RATE_LIMITS = {
  signupPerIp: { limit: 10, windowMs: HOUR_MS },
  loginPerIp: { limit: 20, windowMs: 10 * MINUTE_MS },
  loginPerEmail: { limit: 8, windowMs: 10 * MINUTE_MS },
};

type RateLimitRule = { limit: number; windowMs: number };

async function isRateLimited(key: string, { limit, windowMs }: RateLimitRule) {
  const db = await getDb();
  const result = await rateLimit(new PostgresRateLimitStore(db), key, limit, windowMs);
  return !result.allowed;
}

/** Only dashboard paths are accepted after login, so `?next=` cannot redirect off-site. */
function safeRedirectPath(next: string) {
  return next.startsWith(paths.dashboard.root) ? next : paths.dashboard.root;
}

// ----------------------------------------------------------------------

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = {
    name: formText(formData, 'name'),
    email: formText(formData, 'email'),
    password: formText(formData, 'password'),
  };
  const values = { name: input.name, email: input.email };
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, values);

  const ip = clientIp(await headers());
  if (await isRateLimited(`signup:${ip}`, RATE_LIMITS.signupPerIp)) {
    return {
      ok: false,
      errors: { form: 'Too many sign-ups from this network. Try again later.' },
      values,
    };
  }

  const { name, email, password } = parsed.data;
  const db = await getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    return { ok: false, errors: { email: 'An account with this email already exists' }, values };
  }

  const passwordHash = await hashPassword(password);
  const userId = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, name, passwordHash })
      .returning({ id: users.id });
    if (!user) throw new AppError('signup_failed', 'Could not create the account', 500);
    await tx
      .insert(workspaces)
      .values({ name: `${name.split(' ')[0]}'s workspace`, ownerId: user.id });
    return user.id;
  });

  await createSession(userId);
  logger.info('user signed up', { userId });
  redirect(paths.dashboard.root);
}

// ----------------------------------------------------------------------

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = { email: formText(formData, 'email'), password: formText(formData, 'password') };
  const values = { email: input.email };
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, values);

  const { email, password } = parsed.data;
  const ip = clientIp(await headers());
  if (
    (await isRateLimited(`login:ip:${ip}`, RATE_LIMITS.loginPerIp)) ||
    (await isRateLimited(`login:email:${email}`, RATE_LIMITS.loginPerEmail))
  ) {
    return {
      ok: false,
      errors: { form: 'Too many login attempts. Please wait a few minutes and try again.' },
      values,
    };
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  // Always run scrypt so the response time does not reveal whether the account exists.
  const isPasswordValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !isPasswordValid) {
    return { ok: false, errors: { form: 'Incorrect email or password' }, values };
  }

  await createSession(user.id);
  redirect(safeRedirectPath(formText(formData, 'next')));
}

// ----------------------------------------------------------------------

export async function logout() {
  await destroySession();
  redirect(paths.auth.login);
}
