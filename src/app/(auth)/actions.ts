'use server';

import type { FieldErrors } from 'src/server/validation';

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getDb } from 'src/server/db';
import { logger } from 'src/server/logger';
import { clientIp } from 'src/server/http/request';
import { users, workspaces } from 'src/server/db/schema';
import { createSession, destroySession } from 'src/server/auth/session';
import { rateLimit, PostgresRateLimitStore } from 'src/server/ratelimit';
import { fieldErrors, loginSchema, signupSchema } from 'src/server/validation';
import { DUMMY_HASH, hashPassword, verifyPassword } from 'src/server/auth/password';

export type AuthState = { errors?: FieldErrors; values?: Record<string, string> } | undefined;

function safeNext(next: FormDataEntryValue | null) {
  const v = typeof next === 'string' ? next : '';
  return v.startsWith('/dashboard') && !v.startsWith('//') ? v : '/dashboard';
}

async function limited(key: string, limit: number, windowMs: number) {
  const db = await getDb();
  const r = await rateLimit(new PostgresRateLimitStore(db), key, limit, windowMs);
  return !r.allowed;
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };
  const values = { name: raw.name, email: raw.email };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const ip = clientIp(await headers());
  if (await limited(`signup:${ip}`, 10, 3_600_000))
    return { errors: { form: 'Too many sign-ups from this network. Try again later.' }, values };

  const db = await getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email));
  if (existing) return { errors: { email: 'An account with this email already exists' }, values };

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ email: parsed.data.email, name: parsed.data.name, passwordHash })
      .returning({ id: users.id });
    await tx
      .insert(workspaces)
      .values({ name: `${parsed.data.name.split(' ')[0]}'s workspace`, ownerId: u!.id });
    return u!;
  });
  await createSession(user.id);
  logger.info('user signed up', { userId: user.id });
  redirect('/dashboard');
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };
  const values = { email: raw.email };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const ip = clientIp(await headers());
  if (
    (await limited(`login:ip:${ip}`, 20, 600_000)) ||
    (await limited(`login:email:${parsed.data.email}`, 8, 600_000))
  ) {
    return {
      errors: { form: 'Too many login attempts. Please wait a few minutes and try again.' },
      values,
    };
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  // Always run scrypt so response time does not reveal whether the account exists.
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { errors: { form: 'Incorrect email or password' }, values };

  await createSession(user.id);
  redirect(safeNext(formData.get('next')));
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
