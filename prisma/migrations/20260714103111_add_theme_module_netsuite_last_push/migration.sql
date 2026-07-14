-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyDomain" TEXT NOT NULL,
    "primaryDomain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan" TEXT,
    "contactEmail" TEXT,
    "themeName" TEXT,
    "themeVersion" TEXT,
    "grantedScopes" TEXT,
    "shippingModule" BOOLEAN NOT NULL DEFAULT false,
    "dataConnected" BOOLEAN NOT NULL DEFAULT false,
    "fansifterConnected" BOOLEAN NOT NULL DEFAULT false,
    "themeModule" BOOLEAN NOT NULL DEFAULT false,
    "netsuiteLastPush" DATETIME,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" DATETIME,
    "lastSyncedAt" DATETIME
);
INSERT INTO "new_Store" ("contactEmail", "dataConnected", "fansifterConnected", "grantedScopes", "id", "installedAt", "lastSyncedAt", "plan", "primaryDomain", "shippingModule", "shopifyDomain", "status", "themeName", "themeVersion", "uninstalledAt") SELECT "contactEmail", "dataConnected", "fansifterConnected", "grantedScopes", "id", "installedAt", "lastSyncedAt", "plan", "primaryDomain", "shippingModule", "shopifyDomain", "status", "themeName", "themeVersion", "uninstalledAt" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE UNIQUE INDEX "Store_shopifyDomain_key" ON "Store"("shopifyDomain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
