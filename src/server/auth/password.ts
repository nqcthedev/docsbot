import type { ScryptOptions } from 'node:crypto';

import { randomBytes, timingSafeEqual, scrypt as scryptCb } from 'node:crypto';

const scrypt = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)))
  );

const PARAMS = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };

/** scrypt (memory-hard, built into Node — no native addons). Format: scrypt$N$r$p$salt$hash */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    maxmem: 128 * PARAMS.N * PARAMS.r * 2,
  });
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, 'base64url');
  const N = Number(n);
  if (!Number.isInteger(N) || N < 2 || N > 2 ** 20) return false;
  const key = await scrypt(
    password.normalize('NFKC'),
    Buffer.from(saltB64, 'base64url'),
    expected.length,
    {
      N,
      r: Number(r),
      p: Number(p),
      maxmem: 128 * N * Number(r) * 2,
    }
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Well-formed hash of a random password, verified against when the e-mail does not exist so timing does not leak accounts. */
export const DUMMY_HASH = 'scrypt$32768$8$1$c2FsdHNhbHRzYWx0c2FsdA$' + 'A'.repeat(86);
