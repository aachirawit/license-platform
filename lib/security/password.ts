import argon2 from "argon2";

// Admin password hashing. Unlike licence keys (high-entropy random tokens, so
// HMAC is right), admin passwords are low-entropy human secrets and MUST use a
// slow memory-hard hash so a leaked database cannot be brute-forced offline.
// argon2id is the current recommendation.

const OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // A malformed stored hash should read as "no match", never throw into the
    // login handler.
    return false;
  }
}
