import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { createHmac, randomBytes } from "node:crypto";

// Development seed: three apps, a package set each, a dev admin, and a handful
// of sample licences so the dashboard has something to show immediately.
//
// The dev admin credentials below are DEVELOPMENT ONLY and MUST be changed
// before any real deployment - either seed with different values via env, or
// rotate the password from the Admins page after first login.

const prisma = new PrismaClient();

const DEV_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const DEV_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!123";
const DEV_ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Dev Admin";

const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomGroup(len: number): string {
  let out = "";
  for (const byte of randomBytes(len * 2)) {
    if (out.length === len) break;
    out += KEY_ALPHABET[byte % KEY_ALPHABET.length];
  }
  return out.padEnd(len, "X").slice(0, len);
}

function makeKey(prefix: string): string {
  return `${prefix}-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;
}

function keyPrefixOf(key: string): string {
  const [a, b] = key.split("-");
  return b ? `${a}-${b}` : (a ?? key);
}

function hashKey(raw: string): string {
  const secret = process.env.LICENSE_HMAC_SECRET;
  if (!secret) throw new Error("LICENSE_HMAC_SECRET must be set to seed licences");
  return createHmac("sha256", secret).update(raw.toUpperCase()).digest("hex");
}

const APPS = [
  { name: "SZK Optimizer", slug: "szk-optimizer", appId: "SZK", keyPrefix: "SZKP", icon: "Zap" },
  { name: "Game Booster", slug: "game-booster", appId: "GAMEBOOST", keyPrefix: "GBST", icon: "Gamepad2" },
  { name: "Mouse Optimizer", slug: "mouse-optimizer", appId: "MOUSEOPT", keyPrefix: "MOUS", icon: "Mouse" },
];

const PACKAGES = [
  { name: "Premium 7 Days", slug: "premium-7", durationDays: 7, priceCents: 299 },
  { name: "Premium 30 Days", slug: "premium-30", durationDays: 30, priceCents: 799 },
  { name: "Premium 90 Days", slug: "premium-90", durationDays: 90, priceCents: 1999 },
  { name: "Premium 365 Days", slug: "premium-365", durationDays: 365, priceCents: 4999 },
  { name: "Lifetime", slug: "lifetime", durationDays: 0, priceCents: 9999 },
];

async function main() {
  console.log("Seeding…");

  // Admin (idempotent).
  const passwordHash = await argon2.hash(DEV_ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  await prisma.admin.upsert({
    where: { email: DEV_ADMIN_EMAIL },
    update: {},
    create: {
      email: DEV_ADMIN_EMAIL,
      name: DEV_ADMIN_NAME,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });
  console.log(`  admin: ${DEV_ADMIN_EMAIL} (password: ${DEV_ADMIN_PASSWORD}) — CHANGE BEFORE PRODUCTION`);

  for (const appDef of APPS) {
    const app = await prisma.app.upsert({
      where: { slug: appDef.slug },
      update: {},
      create: {
        name: appDef.name,
        slug: appDef.slug,
        appId: appDef.appId,
        icon: appDef.icon,
        keyPrefix: appDef.keyPrefix,
        provider: "MOCK",
        status: "ACTIVE",
      },
    });

    const packages = [];
    for (const pkg of PACKAGES) {
      packages.push(
        await prisma.licensePackage.upsert({
          where: { appId_slug: { appId: app.id, slug: pkg.slug } },
          update: {},
          create: {
            appId: app.id,
            name: pkg.name,
            slug: pkg.slug,
            durationDays: pkg.durationDays,
            priceCents: pkg.priceCents,
          },
        }),
      );
    }

    // Sample licences only if this app has none yet, so re-seeding is safe.
    const existing = await prisma.license.count({ where: { appId: app.id } });
    if (existing === 0) {
      const pkg30 = packages.find((p) => p.slug === "premium-30")!;
      for (let i = 0; i < 8; i++) {
        const raw = makeKey(appDef.keyPrefix);
        const expiresAt =
          i % 4 === 3 ? new Date(Date.now() - 86_400_000) : new Date(Date.now() + 30 * 86_400_000);
        const license = await prisma.license.create({
          data: {
            appId: app.id,
            provider: "MOCK",
            keyHash: hashKey(raw),
            keyPrefix: keyPrefixOf(raw),
            packageId: pkg30.id,
            status: i % 4 === 0 ? "UNUSED" : "ACTIVE",
            expiresAt,
            activatedAt: i % 4 === 0 ? null : new Date(),
          },
        });
        await prisma.license.update({
          where: { id: license.id },
          data: { providerLicenseId: license.id },
        });
      }
      console.log(`  ${appDef.name}: 5 packages, 8 sample licences`);
    } else {
      console.log(`  ${appDef.name}: packages ensured (licences already present)`);
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
