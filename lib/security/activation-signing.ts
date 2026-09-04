import { createPrivateKey, sign, type KeyObject } from "node:crypto";

import { logger } from "@/lib/logger";

// Ed25519 signing for public activation responses.
//
// A reply from /api/activate decides whether a desktop client unlocks. Over
// plain TLS a proxy with a trusted root certificate could forge a "valid"
// reply; signing closes that. The client verifies an Ed25519 signature over
// (timestamp + body) - the exact scheme it already uses for KeyAuth - so the
// deciding trust is a key the attacker does not have, not the TLS session.
//
// The private key lives ONLY in the server environment
// (ACTIVATION_SIGNING_PRIVATE_KEY: a base64-encoded PKCS8 PEM). The matching
// public key is compiled into the client. Signing is optional: with no key set
// this is a no-op and replies go out unsigned (trusted over TLS only), which
// keeps a deployment working before keys are provisioned. Set the key on both
// sides to harden.

let cached: KeyObject | null | undefined;

function privateKey(): KeyObject | null {
  if (cached !== undefined) return cached;

  const b64 = process.env.ACTIVATION_SIGNING_PRIVATE_KEY;
  if (!b64) {
    cached = null;
    return null;
  }

  try {
    const pem = Buffer.from(b64, "base64").toString("utf8");
    cached = createPrivateKey({ key: pem, format: "pem" });
  } catch (err) {
    // A misconfigured key must fail loud in the log but never break activation;
    // treat it as "signing disabled" so keys can be rotated without an outage.
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "activation_signing_key_invalid",
    );
    cached = null;
  }
  return cached;
}

/** True when responses will be signed (a valid private key is configured). */
export function isActivationSigningEnabled(): boolean {
  return privateKey() !== null;
}

export interface SignatureHeaders {
  "x-signature-ed25519": string;
  "x-signature-timestamp": string;
}

/**
 * Signs `timestamp + body` and returns the two headers, or null when signing is
 * disabled. The timestamp (unix seconds) is bound into the signature, so it
 * cannot be swapped for a fresh one to replay an old reply.
 */
export function signActivationBody(body: string): SignatureHeaders | null {
  const key = privateKey();
  if (!key) return null;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign(null, Buffer.from(timestamp + body, "utf8"), key);
  return {
    "x-signature-ed25519": signature.toString("hex"),
    "x-signature-timestamp": timestamp,
  };
}
