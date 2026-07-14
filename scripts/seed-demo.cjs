// Seed the registry with sample stores so the registry page is demo-ready and the
// sample actions (re-sync, enable module, connect Data/Fansifter, degraded mode)
// have varied rows to act on. Idempotent (upsert). Mirrors the spec's demo stores.
//
//   node scripts/seed-demo.cjs          # add/refresh the sample rows
//   node scripts/seed-demo.cjs --clear  # remove only the seeded sample rows
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

// Marked with a shared domain suffix so --clear can target only seeded rows.
const SAMPLES = [
  {
    shopifyDomain: "sony-demo-main.myshopify.com",
    primaryDomain: "https://shop.sonymusic-demo.com",
    status: "active",
    plan: "Shopify Plus",
    contactEmail: "ops@sonymusic-demo.com",
    themeName: "Dawn",
    grantedScopes: "read_themes,write_products,write_shipping",
    shippingModule: true,
    dataConnected: true,
    fansifterConnected: false,
    installedAt: daysAgo(30),
    lastSyncedAt: daysAgo(0),
  },
  {
    shopifyDomain: "sony-demo-fresh.myshopify.com",
    primaryDomain: "https://sony-demo-fresh.myshopify.com",
    status: "active",
    plan: "Basic",
    contactEmail: "owner@sony-demo-fresh.com",
    themeName: "Craft",
    grantedScopes: "read_themes,write_products",
    shippingModule: false,
    dataConnected: false,
    fansifterConnected: false,
    installedAt: daysAgo(2),
    lastSyncedAt: daysAgo(1),
  },
  {
    shopifyDomain: "sony-fansifter-pilot.myshopify.com",
    primaryDomain: "https://fansifter-pilot.com",
    status: "active",
    plan: "Shopify",
    contactEmail: "pilot@fansifter.com",
    themeName: "Sense",
    grantedScopes: "read_themes,write_products,write_shipping,write_themes",
    shippingModule: true,
    dataConnected: true,
    fansifterConnected: true,
    installedAt: daysAgo(14),
    lastSyncedAt: daysAgo(0),
  },
  {
    shopifyDomain: "sony-legacy-store.myshopify.com",
    primaryDomain: "https://legacy.sonymusic-demo.com",
    status: "uninstalled",
    plan: "Shopify",
    contactEmail: "legacy@sonymusic-demo.com",
    themeName: "Debut",
    grantedScopes: "read_themes",
    shippingModule: false,
    dataConnected: false,
    fansifterConnected: false,
    installedAt: daysAgo(120),
    uninstalledAt: daysAgo(9),
    lastSyncedAt: daysAgo(9),
  },
];

async function main() {
  if (process.argv.includes("--clear")) {
    const domains = SAMPLES.map((s) => s.shopifyDomain);
    const del = await db.store.deleteMany({ where: { shopifyDomain: { in: domains } } });
    console.log(`Removed ${del.count} seeded sample store(s).`);
    return;
  }
  for (const s of SAMPLES) {
    const { shopifyDomain, ...rest } = s;
    await db.store.upsert({
      where: { shopifyDomain },
      create: { shopifyDomain, ...rest },
      update: rest,
    });
    console.log(`  upserted ${shopifyDomain} (${rest.status})`);
  }
  const total = await db.store.count();
  console.log(`Seeded ${SAMPLES.length} sample stores. Registry now has ${total} row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
