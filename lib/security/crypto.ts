import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

// Server-only cryptography helpers. This module must never be imported from a
// client component - it reads server secrets and hashes identifiers.

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 16) {
    throw new Error(
      `${name} is not set (or too short). Generate one and put it in .env.local - see .env.example.`,
    );
  }
  return value;
}

// ─── License keys ─────────────────────────────────────────────────────────────

// Excludes visually ambiguous characters (0/O, 1/I) so a key read off a screen
// or a receipt is unambiguous.
const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// One 4-char group drawn from CSPRNG bytes with rejection sampling, so every
// character is uniform over the alphabet (no modulo bias).
function randomGroup(length: number): string {
  const alphabetLength = KEY_ALPHABET.length;
  // 256 % 32 === 0, so for a 32-char alphabet every byte maps uniformly; the
  // rejection guard below keeps this correct if the alphabet ever changes.
  const maxUnbiased = Math.floor(256 / alphabetLength) * alphabetLength;
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= maxUnbiased) continue;
      out += KEY_ALPHABET[byte % alphabetLength];
      if (out.length === length) break;
    }
  }
  return out;
}

/**
 * A cryptographically secure licence key: PREFIX-XXXX-XXXX-XXXX.
 * The prefix identifies the app (e.g. "SZKP"); the three random groups carry
 * ~60 bits of entropy, which is collision-resistant for any realistic volume.
 */
export function generateLicenseKey(prefix: string): string {
  const clean = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "KEY";
  return `${clean}-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;
}

/** The masked, first-group-only form kept for display: "SZKP-7X2K". */
export function keyPrefixOf(key: string): string {
  const parts = key.split("-");
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : parts[0] ?? key;
}

/**
 * HMAC-SHA256 of a raw key, keyed by a server secret.
 *
 * Why HMAC and not a bare SHA-256, and not argon2:
 *   - Licence keys are high-entropy random tokens, so slow password hashing
 *     (argon2/bcrypt) buys nothing - there is no dictionary to grind.
 *   - Keying the hash with a server-only secret means a database dump alone
 *     cannot be used to test candidate keys offline; an attacker also needs the
 *     secret, which lives only in the environment.
 *   - It is deterministic, so a login can look a key up by hash in one indexed
 *     read rather than scanning and comparing every row.
 */
export function hashLicenseKey(rawKey: string): string {
  return createHmac("sha256", requireSecret("LICENSE_HMAC_SECRET"))
    .update(rawKey.trim().toUpperCase())
    .digest("hex");
}

// ─── Reversible key storage (AES-256-GCM) ──────────────────────────────────────
//
// The keyHash above is one-way (for lookup + uniqueness). Separately, we keep an
// ENCRYPTED copy of the plaintext so an admin can reveal/copy a key from the
// panel later. Encryption, not plaintext: a database dump on its own is useless
// without KEY_ENCRYPTION_SECRET, which lives only in the server environment.
//
// Format: "iv.tag.ciphertext", all hex. A fresh random 96-bit IV per encryption;
// GCM's auth tag detects any tampering on decrypt.

function encryptionKey(): Buffer {
  // Prefer a dedicated KEY_ENCRYPTION_SECRET. If it is not set, derive the key
  // from LICENSE_HMAC_SECRET (already required to run) so encrypted key storage
  // works out of the box without provisioning another env var. A dedicated
  // secret is still cleaner - set KEY_ENCRYPTION_SECRET to use it. Either way,
  // SHA-256 turns the arbitrary-length secret into a fixed 32-byte AES key.
  const secret = process.env.KEY_ENCRYPTION_SECRET || requireSecret("LICENSE_HMAC_SECRET");
  return createHash("sha256").update(secret).digest();
}

export function encryptKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${ct.toString("hex")}`;
}

export function decryptKey(stored: string): string {
  const [ivHex, tagHex, ctHex] = stored.split(".");
  if (!ivHex || !tagHex || !ctHex) throw new Error("Malformed encrypted key");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]).toString(
    "utf8",
  );
}

// ─── HWID ─────────────────────────────────────────────────────────────────────

/**
 * HMAC-SHA256 of a client hardware id, keyed by a separate server secret.
 * The raw HWID is a persistent device identifier and is treated as sensitive:
 * it is never stored, never logged in full, and never returned to a client on a
 * mismatch. Storing only the keyed hash means the database cannot be used to
 * re-identify a machine without the server secret.
 */
export function hashHwid(rawHwid: string): string {
  return createHmac("sha256", requireSecret("HWID_HMAC_SECRET"))
    .update(rawHwid.trim())
    .digest("hex");
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

/** A 256-bit opaque session token for the HTTP-only cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 of a session token. Only the hash is stored, so a database read
 * cannot forge a live session cookie. (Plain SHA-256 is right here: the token
 * is already 256 bits of CSPRNG output, so there is nothing to brute-force.)
 */
export function hashSessionToken(token: string): string {
  return createHmac("sha256", requireSecret("AUTH_SECRET")).update(token).digest("hex");
}

/** Constant-time compare for two hex/base64 digests of equal length. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
