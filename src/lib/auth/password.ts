// Password hashing using bcryptjs. Native bcrypt and argon2 require Node-only
// bindings and break Cloudflare Workers builds; bcryptjs is the only option.

import bcrypt from 'bcryptjs';

const COST_FACTOR = 10;

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  return bcrypt.hash(plain, COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}
