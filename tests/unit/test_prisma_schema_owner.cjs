const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('[TEST] Checking Prisma schema ownership constraints...');

// 1. Check backend/api/package.json
const apiPkgPath = path.resolve(__dirname, '../../backend/api/package.json');
const apiPkg = JSON.parse(fs.readFileSync(apiPkgPath, 'utf8'));

for (const [scriptName, scriptCmd] of Object.entries(apiPkg.scripts || {})) {
  const normalized = scriptCmd.toLowerCase();
  if (normalized.includes('prisma migrate') || normalized.includes('prisma db push')) {
    // If it mentions them, it must be an exit 1 error blocker
    assert(
      normalized.includes('exit 1') || normalized.includes('prohibited'),
      `Script "${scriptName}" in backend/api/package.json attempts to run prisma migrate or prisma db push without blocking: "${scriptCmd}"`
    );
  }
}
console.log('[PASS] backend/api/package.json scripts verified: no mutating prisma migrate or db push scripts allowed.');

// 2. Check root package.json
const rootPkgPath = path.resolve(__dirname, '../../package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));

for (const [scriptName, scriptCmd] of Object.entries(rootPkg.scripts || {})) {
  const normalized = scriptCmd.toLowerCase();
  assert(
    !normalized.includes('prisma migrate') && !normalized.includes('prisma db push'),
    `Script "${scriptName}" in root package.json contains prohibited command: "${scriptCmd}"`
  );
}
console.log('[PASS] root package.json scripts verified.');

// 3. Check schema.prisma header
const schemaPath = path.resolve(__dirname, '../../backend/api/prisma/schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

assert(
  schemaContent.includes('WARNING: SCHEMA OWNERSHIP AND MIGRATION POLICY') &&
  schemaContent.includes('supabase/migrations') &&
  schemaContent.includes('SOLE AND AUTHORITATIVE'),
  'backend/api/prisma/schema.prisma is missing the mandatory schema ownership warning header'
);
console.log('[PASS] schema.prisma schema ownership warning verified.');

// 4. Check ADR_PRISMA_SCOPE.md
const adrPath = path.resolve(__dirname, '../../docs/migration/ADR_PRISMA_SCOPE.md');
const adrContent = fs.readFileSync(adrPath, 'utf8');

assert(
  adrContent.includes('supabase/migrations') &&
  adrContent.toLowerCase().includes('schema owner'),
  'docs/migration/ADR_PRISMA_SCOPE.md is missing documentation on supabase/migrations being the sole schema owner'
);
console.log('[PASS] ADR_PRISMA_SCOPE.md schema ownership documentation verified.');

console.log('[ALL PRISMA SCHEMA OWNER CHECKS PASSED]');
