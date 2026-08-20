# Modularity & Provider-Swappability Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Dispatch `implementer` subagents per task, review between tasks, run `verifier` for all checks, drive Playwright MCP for browser verification.

> **CRITICAL — Build-Test-Verify Loop:** Every phase goes through: Build → Finish → Test → All Checks (`pnpm check && pnpm check-types && pnpm build`) → Manual Browser Test (Playwright MCP). If ANY step fails, fix and re-run the ENTIRE loop. Do NOT move to the next phase until the current one is fully green. After all 7 phases, run a FULL verification sweep of everything.

---

## Goal

Rework 7 packages in the Fuutu Stack to meet the modularity standard: every external integration must be config-driven and provider-swappable. RBAC must run on permissions, not roles. AI must use OpenRouter as primary provider. Cron must support external job runners.

## Architecture

Provider-swappability pattern (gold standard = `packages/payments`): typed `<Domain>Provider` interface in `types.ts`, active provider selected via `<domain>Config.provider` in `config.ts`, callers import from `@fuutu/<domain>` only — never the concrete provider. RBAC uses a central `AccessPolicy` + `permissionProcedure` middleware. Cron uses a `JobRunner` interface with `in-process` and `trigger-dev` implementations.

## Tech Stack

- Next.js 16, TypeScript strict, pnpm 10, Turborepo
- `@ai-sdk/openai` (for OpenRouter), `evlog` (logging), `@trigger.dev/sdk` (cron, lazy-loaded)
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (storage, already deps)
- Vitest (unit tests), Playwright (E2E), Biome (lint/format)

---

## Global Context — Read This First

### Repos

| Repo | Path | Role |
|---|---|---|
| **fuutu-stack** | `/Users/rushalmosa/repo/fuutu-stack` | **WORK REPO** — all code changes happen here |
| fuutu-stack-nextjs | `/Users/rushalmosa/repo/fuutu-stack-nextjs` | Rules/skills source (read-only, do NOT edit) |

**Rules and skills live in `fuutu-stack-nextjs/.devin/`** — read them for conventions but make ALL code changes in `fuutu-stack`. The `AGENTS.md` at `/Users/rushalmosa/repo/fuutu-stack/AGENTS.md` is the operating manual.

### Commands (run from `/Users/rushalmosa/repo/fuutu-stack`)

```bash
pnpm check              # Biome lint + format (MUST be green before commit)
pnpm check-types        # tsc --noEmit ALL workspaces (MUST be green before commit)
pnpm build              # Full turbo build
pnpm test               # All unit tests
pnpm test:e2e:saas      # SaaS E2E tests (Playwright)
pnpm test:e2e:marketing # Marketing E2E tests
pnpm dev:saas           # Start SaaS app (port 3000)
pnpm db:start           # Start local PostgreSQL + MinIO (Docker)
```

### Key Rules (from AGENTS.md — non-negotiable)

1. **Never hardcode config** — domain config in `packages/<domain>/src/config.ts`, cross-cutting in `@fuutu/config`
2. **No `console.log` in prod** — use `createLogger({ scope })` from `@fuutu/logs`
3. **No `any`** — strict TypeScript
4. **Env vars** — `@fuutu/env/saas`, never `process.env`
5. **i18n** — 100% `useTranslations()` / `getTranslations()`, keys in `en.json` + `de.json` same commit
6. **Provider pattern** — typed interface, one active provider, callers import from `@fuutu/<domain>` only
7. **Kit fingerprint** — 5 emission points must stay intact (see AGENTS.md §8) — DO NOT touch
8. **pnpm catalog** — all shared deps as `"catalog:"` in `pnpm-workspace.yaml`, never hardcode versions
9. **No new runtime deps without adding to catalog** — add to `pnpm-workspace.yaml` catalog first, then `"catalog:"` in package.json

### Provider Pattern Reference (gold standard: packages/payments)

```
packages/<domain>/
  src/
    types.ts          # <Domain>Provider interface
    config.ts         # <domain>Config = { provider: env.X ?? "default", ... }
    provider.ts       # resolve<Domain>Provider() — switch on config, singleton
    index.ts          # public API — re-exports, delegates to resolved provider
    providers/
      <active>.ts     # active provider implementation
      skeletons.ts    # stub implementations for alternatives
```

### Subagent Dispatch

- **`implementer`** — for each task (TDD, edits, verify)
- **`verifier`** — for running `pnpm check && pnpm check-types && pnpm build && pnpm test`
- **`harvest`** — for codebase exploration before implementation
- **You (orchestrator)** — drive Playwright MCP for browser verification, synthesize results

---

## Phase 1: Logs — Config-Driven + evlog Default

### Context

**Current state:** `packages/logs` has `LogProvider` interface (`types.ts:10-12`) and `AuditSink` interface (`types.ts:45-47`). Providers exist: `console.ts`, `pino.ts`, `axiom.ts`. Sinks: `console.ts` only. **Problem:** No `config.ts` — provider selection requires manual `setLogProvider()` / `setAuditSink()` calls. Not config-driven. Breaks swappability promise.

**Target state:** `config.ts` added, `resolveLogProvider()` auto-initializes from config, evlog is default provider, `setLogProvider()` kept as escape hatch but not required.

**Files:**
- Create: `packages/logs/src/config.ts`
- Create: `packages/logs/src/providers/evlog.ts`
- Create: `packages/logs/src/sinks/db.ts`
- Modify: `packages/logs/src/index.ts` (add `resolveLogProvider()`, auto-init)
- Modify: `packages/logs/src/types.ts` (add `LogProviderId`, `AuditSinkId` types)
- Modify: `packages/logs/package.json` (add `evlog` dep)
- Modify: `pnpm-workspace.yaml` (add `evlog` to catalog)
- Modify: `packages/env/src/saas.ts` (add `LOG_PROVIDER`, `LOG_AUDIT_SINK`, `LOG_LEVEL`)
- Test: `packages/logs/src/__tests__/config.test.ts`
- Test: `packages/logs/src/__tests__/evlog-provider.test.ts`

### Task 1.1: Add evlog to catalog + package deps

- [ ] **Step 1: Add evlog to pnpm-workspace.yaml catalog**

Read `pnpm-workspace.yaml`, find the `catalog:` section, add:
```yaml
evlog: ^1.0.0
```
(Check latest stable version via `pnpm info evlog versions --json | tail -5` first — must be ≥7 days old)

- [ ] **Step 2: Add evlog to packages/logs/package.json**

Add to `dependencies`:
```json
"evlog": "catalog:"
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: evlog installed, no errors

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml packages/logs/package.json pnpm-lock.yaml
git commit -m "feat(logs): add evlog dependency"
```

### Task 1.2: Add env vars for logs config

- [ ] **Step 1: Read current env schema**

Read `packages/env/src/saas.ts` to understand the pattern (uses `@t3-oss/env-nextjs`, `createEnv`).

- [ ] **Step 2: Add log env vars**

Add to the `server` section:
```typescript
LOG_PROVIDER: z.enum(["evlog", "console", "pino", "axiom", "noop"]).default("evlog"),
LOG_AUDIT_SINK: z.enum(["console", "db", "axiom", "noop"]).default("console"),
LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
```

Add to `runtimeEnv` mapping:
```typescript
LOG_PROVIDER: process.env.LOG_PROVIDER,
LOG_AUDIT_SINK: process.env.LOG_AUDIT_SINK,
LOG_LEVEL: process.env.LOG_LEVEL,
```

- [ ] **Step 3: Type-check**

Run: `pnpm check-types --filter @fuutu/env`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/env/src/saas.ts
git commit -m "feat(env): add LOG_PROVIDER, LOG_AUDIT_SINK, LOG_LEVEL env vars"
```

### Task 1.3: Create config.ts

- [ ] **Step 1: Write config.ts**

Create `packages/logs/src/config.ts`:
```typescript
import { env } from "@fuutu/env/saas";

export type LogProviderId = "evlog" | "console" | "pino" | "axiom" | "noop";
export type AuditSinkId = "console" | "db" | "axiom" | "noop";

export const logsConfig = {
  provider: env.LOG_PROVIDER,
  auditSink: env.LOG_AUDIT_SINK,
  level: env.LOG_LEVEL,
} as const;
```

- [ ] **Step 2: Write failing test**

Create `packages/logs/src/__tests__/config.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { logsConfig } from "../config";

describe("logsConfig", () => {
  it("should have provider from env", () => {
    expect(["evlog", "console", "pino", "axiom", "noop"]).toContain(logsConfig.provider);
  });
  it("should have auditSink from env", () => {
    expect(["console", "db", "axiom", "noop"]).toContain(logsConfig.auditSink);
  });
  it("should have level from env", () => {
    expect(["debug", "info", "warn", "error"]).toContain(logsConfig.level);
  });
});
```

- [ ] **Step 3: Run test**

Run: `pnpm test --filter @fuutu/logs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/logs/src/config.ts packages/logs/src/__tests__/config.test.ts
git commit -m "feat(logs): add config.ts with provider/sink/level config"
```

### Task 1.4: Create evlog provider

- [ ] **Step 1: Write evlog provider**

Create `packages/logs/src/providers/evlog.ts`:
```typescript
import { log as evlogLog, createLogger as createEvlogLogger } from "evlog";
import type { LogProvider, LogLevel, LogContext } from "../types.js";

export const evlogProvider: LogProvider = {
  log(level: LogLevel, message: string, context?: LogContext): void {
    const ctx = context ?? {};
    switch (level) {
      case "debug":
        evlogLog.debug(ctx, message);
        break;
      case "info":
        evlogLog.info(ctx, message);
        break;
      case "warn":
        evlogLog.warn(ctx, message);
        break;
      case "error":
        evlogLog.error(ctx, message);
        break;
    }
  },
};
```

**Note:** Check the actual evlog API by reading `node_modules/evlog/dist/index.d.ts` — the import names and method signatures may differ from the docs. Adapt the implementation to the actual API.

- [ ] **Step 2: Write failing test**

Create `packages/logs/src/__tests__/evlog-provider.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { evlogProvider } from "../providers/evlog";

describe("evlogProvider", () => {
  it("should have id 'evlog'", () => {
    expect(evlogProvider.id ?? "evlog").toBe("evlog");
  });
  it("should call log without throwing", () => {
    expect(() => evlogProvider.log("info", "test message", { userId: "123" })).not.toThrow();
  });
  it("should handle all log levels", () => {
    expect(() => evlogProvider.log("debug", "debug msg")).not.toThrow();
    expect(() => evlogProvider.log("warn", "warn msg")).not.toThrow();
    expect(() => evlogProvider.log("error", "error msg")).not.toThrow();
  });
});
```

- [ ] **Step 3: Run test**

Run: `pnpm test --filter @fuutu/logs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/logs/src/providers/evlog.ts packages/logs/src/__tests__/evlog-provider.test.ts
git commit -m "feat(logs): add evlog provider implementation"
```

### Task 1.5: Create db audit sink

- [ ] **Step 1: Read db audit table schema**

Read `packages/db/src/prisma/schema/` to find the audit log table and its columns. Read `packages/db/src/prisma/queries/` for existing audit query functions.

- [ ] **Step 2: Write db audit sink**

Create `packages/logs/src/sinks/db.ts`:
```typescript
import type { AuditSink, AuditEvent } from "../types.js";
import { db } from "@fuutu/db";

export const dbAuditSink: AuditSink = {
  async record(event: AuditEvent): Promise<void> {
    await db.auditLog.create({
      data: {
        action: event.action,
        userId: event.userId,
        orgId: event.orgId,
        metadata: event.metadata ?? {},
        timestamp: event.timestamp ?? new Date(),
      },
    });
  },
};
```

**Adapt field names to the actual schema** — read the schema first.

- [ ] **Step 3: Commit**

```bash
git add packages/logs/src/sinks/db.ts
git commit -m "feat(logs): add db audit sink"
```

### Task 1.6: Refactor index.ts — config-driven resolution

- [ ] **Step 1: Read current index.ts**

Read `packages/logs/src/index.ts` — understand `setLogProvider()`, `setAuditSink()`, `createLogger()`, `activeProvider`, `activeAuditSink`.

- [ ] **Step 2: Refactor to config-driven**

Add `resolveLogProvider()` and `resolveAuditSink()` functions that read `logsConfig` and return the matching provider/sink. Auto-initialize `activeProvider` and `activeAuditSink` from config on module load. Keep `setLogProvider()` / `setAuditSink()` as escape hatches.

```typescript
import { logsConfig } from "./config.js";
import { consoleProvider } from "./providers/console.js";
import { evlogProvider } from "./providers/evlog.js";
import { pinoProvider } from "./providers/pino.js";
import { axiomProvider } from "./providers/axiom.js";
import { consoleAuditSink } from "./sinks/console.js";
import { dbAuditSink } from "./sinks/db.js";

function resolveLogProvider(): LogProvider {
  switch (logsConfig.provider) {
    case "evlog": return evlogProvider;
    case "pino": return pinoProvider;
    case "axiom": return axiomProvider;
    case "console":
    case "noop":
    default: return consoleProvider;
  }
}

function resolveAuditSink(): AuditSink {
  switch (logsConfig.auditSink) {
    case "db": return dbAuditSink;
    case "axiom": return axiomAuditSink; // if exists, else console
    case "console":
    case "noop":
    default: return consoleAuditSink;
  }
}

let activeProvider = resolveLogProvider();
let activeAuditSink = resolveAuditSink();

export function setLogProvider(provider: LogProvider): void {
  activeProvider = provider;
}
export function setAuditSink(sink: AuditSink): void {
  activeAuditSink = sink;
}
```

Keep `createLogger({ scope })` unchanged — it uses `activeProvider` internally.

- [ ] **Step 3: Write test for resolveLogProvider**

Add to `packages/logs/src/__tests__/config.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("resolveLogProvider", () => {
  // Test that the default provider is evlog (based on env default)
  it("should initialize with the configured provider", () => {
    // The active provider should match logsConfig.provider
    // This is tested indirectly via createLogger still working
  });
});
```

- [ ] **Step 4: Run all logs tests**

Run: `pnpm test --filter @fuutu/logs`
Expected: PASS

- [ ] **Step 5: Type-check all workspaces**

Run: `pnpm check-types`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add packages/logs/src/index.ts packages/logs/src/__tests__/config.test.ts
git commit -m "feat(logs): config-driven provider resolution, evlog as default"
```

### Task 1.7: Phase 1 Verification Loop

- [ ] **Step 1: Run all checks**

Run: `pnpm check && pnpm check-types && pnpm build`
Expected: ALL PASS

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Run E2E**

Run: `pnpm test:e2e:saas`
Expected: ALL PASS

- [ ] **Step 4: Browser verification**

Start `pnpm dev:saas`, drive Playwright MCP through:
- Login page → login → dashboard
- Check console for ZERO errors/warnings
- Verify logging still works (no crashes from evlog integration)

- [ ] **Step 5: Loop decision**

- ALL green → Phase 1 DONE, proceed to Phase 2
- ANY red → fix, go back to Step 1

---

## Phase 2: Storage — One S3-Compatible Provider

### Context

**Current state:** `StorageProvider` interface in `types.ts` has 4 methods (getSignedUploadUrl, getSignedDownloadUrl, deleteObject, listObjects). `getObjectStream()` in `index.ts:58` hardcodes S3 check, throws for others. S3 provider in `providers/s3.ts` has `fetchObjectStream()` exported separately. No `forcePathStyle` / `endpoint` config.

**Reference:** Plonkify repo (`/Users/rushalmosa/repo/plonkify/packages/storage/`) uses `forcePathStyle: true` + custom `S3_ENDPOINT` to support Hetzner + MinIO. **DO NOT copy their code** — build our own better version following the same pattern.

**Target state:** `getObjectStream` in interface (optional), S3 provider with `forcePathStyle` + `endpoint` + `region` config, R2 skeleton removed (R2 is S3-compatible).

**Files:**
- Modify: `packages/storage/src/types.ts` (add `getObjectStream` to interface)
- Modify: `packages/storage/src/config.ts` (add S3 endpoint/region/forcePathStyle)
- Modify: `packages/storage/src/providers/s3.ts` (add forcePathStyle, endpoint, move stream into provider)
- Modify: `packages/storage/src/index.ts` (remove hardcoded getObjectStream)
- Modify: `packages/storage/src/providers/skeletons.ts` (remove R2, it's S3-compatible)
- Modify: `packages/env/src/saas.ts` (add S3_ENDPOINT, S3_REGION, S3_FORCE_PATH_STYLE)
- Test: `packages/storage/src/__tests__/s3-provider.test.ts`

### Task 2.1: Add storage env vars

- [ ] **Step 1: Read current env + config**

Read `packages/env/src/saas.ts` and `packages/storage/src/config.ts` to understand current storage env vars.

- [ ] **Step 2: Add env vars**

Add to `packages/env/src/saas.ts` server section:
```typescript
S3_ENDPOINT: z.string().url().optional(),
S3_REGION: z.string().default("auto"),
S3_FORCE_PATH_STYLE: z.string().optional().transform((v) => v !== "false"),
```

Add to `runtimeEnv`:
```typescript
S3_ENDPOINT: process.env.S3_ENDPOINT,
S3_REGION: process.env.S3_REGION,
S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
```

- [ ] **Step 3: Type-check**

Run: `pnpm check-types --filter @fuutu/env`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/env/src/saas.ts
git commit -m "feat(env): add S3_ENDPOINT, S3_REGION, S3_FORCE_PATH_STYLE"
```

### Task 2.2: Update config.ts with S3 connection options

- [ ] **Step 1: Read current config**

Read `packages/storage/src/config.ts`.

- [ ] **Step 2: Add S3 connection config**

```typescript
import { env } from "@fuutu/env/saas";

export const storageConfig = {
  provider: env.STORAGE_PROVIDER ?? "s3",
  s3: {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE ?? true,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
} as const;
```

- [ ] **Step 3: Commit**

```bash
git add packages/storage/src/config.ts
git commit -m "feat(storage): add S3 endpoint/region/forcePathStyle config"
```

### Task 2.3: Add getObjectStream to StorageProvider interface

- [ ] **Step 1: Read current types**

Read `packages/storage/src/types.ts`.

- [ ] **Step 2: Add optional getObjectStream + StorageStreamResult type**

```typescript
export interface StorageStreamResult {
  body: ReadableStream<Uint8Array>;
  contentType: string | null;
  contentLength: number | null;
}

export interface StorageProvider {
  readonly id: string;
  getSignedUploadUrl(input: SignedUploadInput): Promise<SignedUploadResult>;
  getSignedDownloadUrl(input: SignedDownloadInput): Promise<string>;
  deleteObject(bucket: string, key: string): Promise<void>;
  listObjects(bucket: string, prefix?: string): Promise<StorageObject[]>;
  getObjectStream?(bucket: string, key: string): Promise<StorageStreamResult>;
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm check-types --filter @fuutu/storage`
Expected: PASS (existing code still works — method is optional)

- [ ] **Step 4: Commit**

```bash
git add packages/storage/src/types.ts
git commit -m "feat(storage): add getObjectStream to StorageProvider interface"
```

### Task 2.4: Refactor S3 provider — forcePathStyle + endpoint + stream method

- [ ] **Step 1: Read current S3 provider**

Read `packages/storage/src/providers/s3.ts` — understand client init, all methods, `fetchObjectStream`.

- [ ] **Step 2: Update S3 client initialization**

Change client init to use `storageConfig.s3`:
```typescript
import { storageConfig } from "../config.js";

const client = new S3Client({
  endpoint: storageConfig.s3.endpoint,
  region: storageConfig.s3.region,
  forcePathStyle: storageConfig.s3.forcePathStyle,
  credentials: {
    accessKeyId: storageConfig.s3.accessKeyId,
    secretAccessKey: storageConfig.s3.secretAccessKey,
  },
});
```

- [ ] **Step 3: Move fetchObjectStream into the provider object**

Add `getObjectStream` method to the S3 provider object (replacing the standalone `fetchObjectStream` export):
```typescript
async getObjectStream(bucket: string, key: string): Promise<StorageStreamResult> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await client.send(command);
  if (!response.body) throw new Error("No body in S3 response");
  return {
    body: response.body as ReadableStream<Uint8Array>,
    contentType: response.ContentType ?? null,
    contentLength: response.ContentLength ?? null,
  };
},
```

Keep `fetchObjectStream` as a deprecated re-export for backward compat if other code uses it — but check first with grep.

- [ ] **Step 4: Write test**

Create/update `packages/storage/src/__tests__/s3-provider.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { s3Provider } from "../providers/s3";

describe("s3Provider", () => {
  it("should have id 's3'", () => {
    expect(s3Provider.id).toBe("s3");
  });
  it("should have getObjectStream method", () => {
    expect(typeof s3Provider.getObjectStream).toBe("function");
  });
});
```

- [ ] **Step 5: Run test**

Run: `pnpm test --filter @fuutu/storage`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/storage/src/providers/s3.ts packages/storage/src/__tests__/s3-provider.test.ts
git commit -m "feat(storage): S3 provider with forcePathStyle, endpoint, getObjectStream"
```

### Task 2.5: Refactor index.ts — remove hardcoded getObjectStream

- [ ] **Step 1: Read current index.ts**

Read `packages/storage/src/index.ts` — find the hardcoded `getObjectStream` at line 58.

- [ ] **Step 2: Replace with interface delegation**

```typescript
export async function getObjectStream(
  bucket: string,
  key: string
): Promise<StorageStreamResult> {
  const provider = resolveStorageProvider();
  if (!provider.getObjectStream) {
    throw new StorageStreamUnavailableError(provider.id);
  }
  return provider.getObjectStream(bucket, key);
}
```

Add `StorageStreamUnavailableError` class:
```typescript
export class StorageStreamUnavailableError extends Error {
  constructor(providerId: string) {
    super(`Storage provider '${providerId}' does not support object streaming`);
    this.name = "StorageStreamUnavailableError";
  }
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm check-types`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add packages/storage/src/index.ts
git commit -m "feat(storage): delegate getObjectStream to provider interface"
```

### Task 2.6: Remove R2 skeleton (it's S3-compatible)

- [ ] **Step 1: Read skeletons**

Read `packages/storage/src/providers/skeletons.ts`.

- [ ] **Step 2: Remove R2 stub**

Remove the R2 skeleton — R2 is S3-compatible, users configure the S3 provider with R2's endpoint. Keep `supabase` (different API) and `noop`.

- [ ] **Step 3: Check for R2 references**

Grep for `r2` across the codebase — update any references.

- [ ] **Step 4: Commit**

```bash
git add packages/storage/src/providers/skeletons.ts
git commit -m "refactor(storage): remove R2 skeleton — S3-compatible, use S3 provider"
```

### Task 2.7: Phase 2 Verification Loop

- [ ] **Step 1: Run all checks**

Run: `pnpm check && pnpm check-types && pnpm build`
Expected: ALL PASS

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Run E2E**

Run: `pnpm test:e2e:saas`
Expected: ALL PASS

- [ ] **Step 4: Browser verification + storage smoke test**

Start `pnpm db:start` (MinIO), start `pnpm dev:saas`, drive Playwright MCP:
- Login → dashboard
- Test file upload (if storage UI exists) or test via API
- Check console for ZERO errors
- Verify MinIO connection works (S3_ENDPOINT=http://localhost:9000)

- [ ] **Step 5: Loop decision**

- ALL green → Phase 2 DONE, proceed to Phase 3
- ANY red → fix, go back to Step 1

---

## Phase 3: Analytics — Script Injection via Interface

### Context

**Current state:** `AnalyticsProvider` interface in `types.ts:22-34` has `trackEvent` + `trackPageview`. `script.tsx:36-42` hardcodes Umami script injection, warns for others. Umami is active provider.

**Target state:** `getScriptProps()` added to interface, each provider returns its own script props, `script.tsx` delegates to provider.

**Files:**
- Modify: `packages/analytics/src/types.ts` (add `getScriptProps` + `AnalyticsScriptProps`)
- Modify: `packages/analytics/src/providers/umami.ts` (implement `getScriptProps`)
- Modify: `packages/analytics/src/providers/skeletons.ts` (add `getScriptProps` to each)
- Modify: `packages/analytics/src/script.tsx` (delegate to provider)
- Test: `packages/analytics/src/__tests__/script.test.ts`

### Task 3.1: Add getScriptProps to interface

- [ ] **Step 1: Read current types**

Read `packages/analytics/src/types.ts`.

- [ ] **Step 2: Add AnalyticsScriptProps + getScriptProps**

```typescript
export interface AnalyticsScriptProps {
  src: string;
  strategy: "afterInteractive" | "lazyOnload" | "beforeInteractive";
  attributes?: Record<string, string>;
}

export interface AnalyticsProvider {
  readonly id: AnalyticsProviderId;
  trackEvent(name: string, props?: AnalyticsEventProps): void;
  trackPageview(url?: string): void;
  getScriptProps?(): AnalyticsScriptProps | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/analytics/src/types.ts
git commit -m "feat(analytics): add getScriptProps to AnalyticsProvider interface"
```

### Task 3.2: Implement getScriptProps in Umami provider

- [ ] **Step 1: Read current umami provider + config**

Read `packages/analytics/src/providers/umami.ts` and `packages/analytics/src/config.ts`.

- [ ] **Step 2: Add getScriptProps to umami provider**

```typescript
getScriptProps(): AnalyticsScriptProps {
  return {
    src: analyticsConfig.umami.scriptUrl,
    strategy: "afterInteractive",
    attributes: {
      "data-website-id": analyticsConfig.umami.websiteId,
      "data-auto-track": "false",
    },
  };
},
```

- [ ] **Step 3: Commit**

```bash
git add packages/analytics/src/providers/umami.ts
git commit -m "feat(analytics): implement getScriptProps in Umami provider"
```

### Task 3.3: Add getScriptProps to skeleton providers

- [ ] **Step 1: Read skeletons**

Read `packages/analytics/src/providers/skeletons.ts`.

- [ ] **Step 2: Add getScriptProps to each skeleton**

Each provider (plausible, pirsch, mixpanel, ga4) returns its own script props. noop returns `null`.

Example for plausible:
```typescript
getScriptProps(): AnalyticsScriptProps {
  return {
    src: `https://plausible.io/js/script.js`,
    strategy: "afterInteractive",
    attributes: { "data-domain": "example.com" },
  };
},
```

noop:
```typescript
getScriptProps(): null {
  return null;
},
```

- [ ] **Step 3: Commit**

```bash
git add packages/analytics/src/providers/skeletons.ts
git commit -m "feat(analytics): add getScriptProps to all skeleton providers"
```

### Task 3.4: Refactor script.tsx — delegate to provider

- [ ] **Step 1: Read current script.tsx**

Read `packages/analytics/src/script.tsx` — find the hardcoded umami check at line 36-42.

- [ ] **Step 2: Replace with provider delegation**

```tsx
"use client";
import Script from "next/script";
import { resolveAnalyticsProvider } from "./provider";
import { readConsentCookie } from "./consent";

export function AnalyticsScript() {
  const provider = resolveAnalyticsProvider();
  const scriptProps = provider.getScriptProps?.();

  if (!scriptProps) return null;

  // Consent check stays cross-provider
  const hasConsent = readConsentCookie();
  if (!hasConsent) return null;

  return <Script {...scriptProps} attributes={scriptProps.attributes} />;
}
```

- [ ] **Step 3: Write test**

```typescript
import { describe, it, expect, vi } from "vitest";

describe("AnalyticsScript", () => {
  it("should return null for noop provider", () => {
    // Mock provider to return null from getScriptProps
    // Verify component renders null
  });
});
```

- [ ] **Step 4: Run test**

Run: `pnpm test --filter @fuutu/analytics`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/analytics/src/script.tsx packages/analytics/src/__tests__/script.test.ts
git commit -m "feat(analytics): delegate script injection to provider interface"
```

### Task 3.5: Phase 3 Verification Loop

- [ ] **Step 1: Run all checks**

Run: `pnpm check && pnpm check-types && pnpm build`
Expected: ALL PASS

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Browser verification**

Start `pnpm dev:saas`, drive Playwright MCP:
- Load any page with analytics script
- Check console for ZERO errors
- Verify script tag renders correctly (check DOM)
- Verify consent banner still works

- [ ] **Step 4: Loop decision**

- ALL green → Phase 3 DONE, proceed to Phase 4
- ANY red → fix, go back to Step 1

---

## Phase 4: RBAC — Permission-Based Authorization (Full Migration)

### Context

**Current state — CRITICAL:**
- 12 role-check sites in production code, 0 permission-check sites
- `AccessControl`, `hasPermission`, `canCRUD` exist in `packages/rbac` but are completely unused outside tests
- No `AccessControl` instance or `AccessPolicy` defined anywhere
- 11 of 12 API modules have only `protectedProcedure` (auth-only, no authorization)
- `adminProcedure` checks role via `hasRoleAtLeast(role, "admin")`
- `isAdmin()` in `packages/auth/src/types.ts:46` checks role

**Role-check sites to migrate (12 total):**
- `packages/api/src/orpc/procedures.ts:28-29` — adminProcedure
- `packages/api/src/modules/organizations/shared.ts:40` — requireOrgRole
- `packages/api/src/modules/organizations/members/procedures/invite.ts:27`
- `packages/api/src/modules/organizations/members/procedures/remove.ts:37,44,45,48-50`
- `packages/api/src/modules/organizations/members/procedures/update-role.ts:37`
- `packages/auth/src/types.ts:38,46` — toRbacRole, isAdmin
- `apps/saas/src/lib/auth-server.ts:42` — requireAdmin via isAdmin
- `apps/saas/src/modules/app/components/sidebar.tsx:37` — isAdmin
- `apps/saas/src/modules/app/organizations/org-settings-members.tsx:64,234`
- `apps/saas/src/modules/app/organizations/org-settings-danger.tsx:53`
- `apps/saas/src/modules/app/admin/admin-users-table.tsx:148,172`

**Target state:** Central `AccessPolicy`, `permissionProcedure` middleware, all 12 sites migrated, all API modules get permission middleware, enforce-test that's abschaltbar.

**Files:**
- Create: `packages/rbac/src/policy.ts`
- Modify: `packages/rbac/src/index.ts` (export policy + new helpers)
- Modify: `packages/api/src/orpc/procedures.ts` (add permissionProcedure)
- Modify: `packages/api/src/modules/organizations/shared.ts` (requireOrgPermission)
- Modify: `packages/api/src/modules/organizations/members/procedures/invite.ts`
- Modify: `packages/api/src/modules/organizations/members/procedures/remove.ts`
- Modify: `packages/api/src/modules/organizations/members/procedures/update-role.ts`
- Modify: `packages/auth/src/types.ts` (remove isAdmin, add hasPermission)
- Modify: `apps/saas/src/lib/auth-server.ts`
- Modify: `apps/saas/src/modules/app/components/sidebar.tsx`
- Modify: `apps/saas/src/modules/app/organizations/org-settings-members.tsx`
- Modify: `apps/saas/src/modules/app/organizations/org-settings-danger.tsx`
- Modify: `apps/saas/src/modules/app/admin/admin-users-table.tsx`
- Modify: ALL `packages/api/src/modules/*/procedures/*.ts` (add permissionProcedure)
- Create: `packages/rbac/src/__tests__/enforce-permissions.test.ts`
- Create: `packages/rbac/src/__tests__/policy.test.ts`

### Task 4.1: Create central AccessPolicy

- [ ] **Step 1: Read current rbac package**

Read `packages/rbac/src/index.ts` — understand `AccessControl`, `createResourcePermissions`, `ROLE_HIERARCHY`, `hasPermission`, `canCRUD`.

- [ ] **Step 2: Write policy.ts**

Create `packages/rbac/src/policy.ts`:
```typescript
import { createResourcePermissions, type AccessPolicy } from "./index.js";

// Custom permissions (not CRUD-generated)
export const PERMISSIONS = {
  // AI
  USE_AI: "use:ai",
  // Billing
  MANAGE_BILLING: "manage:billing",
  // Organization member management
  INVITE_ORGANIZATION: "invite:organization",
  REMOVE_ORGANIZATION: "remove:organization",
  UPDATE_ORGANIZATION: "update:organization",
  // Admin
  VIEW_ADMIN: "view:admin",
} as const;

export const DEFAULT_ACCESS_POLICY: AccessPolicy = {
  member: [
    ...createResourcePermissions("api-key"),
    ...createResourcePermissions("webhook"),
    ...createResourcePermissions("notification"),
    ...createResourcePermissions("chat"),
    ...createResourcePermissions("credit"),
    ...createResourcePermissions("storage"),
    ...createResourcePermissions("crm"),
    ...createResourcePermissions("activity"),
    ...createResourcePermissions("organization"),
    PERMISSIONS.USE_AI,
  ],
  admin: [
    ...createResourcePermissions("user"),
    ...createResourcePermissions("audit-log"),
    ...createResourcePermissions("payment"),
    ...createResourcePermissions("admin"),
    PERMISSIONS.VIEW_ADMIN,
    PERMISSIONS.INVITE_ORGANIZATION,
    PERMISSIONS.REMOVE_ORGANIZATION,
    PERMISSIONS.UPDATE_ORGANIZATION,
  ],
  owner: [
    PERMISSIONS.MANAGE_BILLING,
    "delete:organization",
  ],
};
```

**Note:** Policy is additive — admin inherits member, owner inherits admin. The `AccessControl` class must handle inheritance (check if it already does via `ROLE_HIERARCHY`, if not, update it).

- [ ] **Step 3: Export from index.ts**

Add to `packages/rbac/src/index.ts`:
```typescript
export { DEFAULT_ACCESS_POLICY, PERMISSIONS } from "./policy.js";
```

- [ ] **Step 4: Write policy test**

Create `packages/rbac/src/__tests__/policy.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { DEFAULT_ACCESS_POLICY, PERMISSIONS } from "../policy";
import { AccessControl, hasPermission, toRbacRole } from "../index";

describe("DEFAULT_ACCESS_POLICY", () => {
  const ac = new AccessControl(DEFAULT_ACCESS_POLICY);

  it("member can view api-keys", () => {
    expect(hasPermission(ac, "member", "view:api-key")).toBe(true);
  });
  it("member cannot view admin", () => {
    expect(hasPermission(ac, "member", PERMISSIONS.VIEW_ADMIN)).toBe(false);
  });
  it("admin can view admin", () => {
    expect(hasPermission(ac, "admin", PERMISSIONS.VIEW_ADMIN)).toBe(true);
  });
  it("admin inherits member permissions", () => {
    expect(hasPermission(ac, "admin", "view:api-key")).toBe(true);
  });
  it("owner can manage billing", () => {
    expect(hasPermission(ac, "owner", PERMISSIONS.MANAGE_BILLING)).toBe(true);
  });
  it("owner inherits admin permissions", () => {
    expect(hasPermission(ac, "owner", PERMISSIONS.VIEW_ADMIN)).toBe(true);
  });
});
```

- [ ] **Step 5: Run test**

Run: `pnpm test --filter @fuutu/rbac`
Expected: PASS (if AccessControl doesn't handle inheritance, fix it here)

- [ ] **Step 6: Commit**

```bash
git add packages/rbac/src/policy.ts packages/rbac/src/index.ts packages/rbac/src/__tests__/policy.test.ts
git commit -m "feat(rbac): add central AccessPolicy with permission definitions"
```

### Task 4.2: Add permissionProcedure to API

- [ ] **Step 1: Read current procedures**

Read `packages/api/src/orpc/procedures.ts` — understand `publicProcedure`, `protectedProcedure`, `adminProcedure`.

- [ ] **Step 2: Add permissionProcedure**

```typescript
import { AccessControl, hasPermission, toRbacRole, DEFAULT_ACCESS_POLICY } from "@fuutu/rbac";

const ac = new AccessControl(DEFAULT_ACCESS_POLICY);

export function permissionProcedure(permission: string) {
  return protectedProcedure.use(async ({ context, next }) => {
    const role = toRbacRole(context.session.user.role);
    if (!hasPermission(ac, role, permission)) {
      throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
    }
    return next({ context });
  });
}
```

- [ ] **Step 3: Add requireOrgPermission**

In `packages/api/src/modules/organizations/shared.ts`, add:
```typescript
export function requireOrgPermission(orgId: string, permission: string) {
  // Get user's role within the org
  // Check permission against DEFAULT_ACCESS_POLICY
  // Throw FORBIDDEN if missing
}
```

- [ ] **Step 4: Type-check**

Run: `pnpm check-types --filter @fuutu/api`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/orpc/procedures.ts packages/api/src/modules/organizations/shared.ts
git commit -m "feat(api): add permissionProcedure and requireOrgPermission middleware"
```

### Task 4.3: Migrate all 12 role-check sites

- [ ] **Step 1: Migrate API procedures**

For each file in the role-check list, replace role checks with permission checks:
- `procedures.ts` — `adminProcedure` uses `permissionProcedure("view:admin")` internally
- `organizations/shared.ts` — `requireOrgRole` → `requireOrgPermission`
- `organizations/members/procedures/invite.ts:27` — `input.role === "owner"` → `requireOrgPermission(orgId, PERMISSIONS.INVITE_ORGANIZATION)`
- `organizations/members/procedures/remove.ts` — role comparisons → `requireOrgPermission(orgId, PERMISSIONS.REMOVE_ORGANIZATION)`
- `organizations/members/procedures/update-role.ts:37` → `requireOrgPermission(orgId, PERMISSIONS.UPDATE_ORGANIZATION)`

- [ ] **Step 2: Migrate auth types**

In `packages/auth/src/types.ts`:
- Remove `isAdmin()` function
- Add `hasPermission(session, permission)` helper that uses `DEFAULT_ACCESS_POLICY`

- [ ] **Step 3: Migrate app code**

- `apps/saas/src/lib/auth-server.ts:42` — `isAdmin(session.user)` → `hasPermission(session, PERMISSIONS.VIEW_ADMIN)`
- `apps/saas/src/modules/app/components/sidebar.tsx:37` — same
- `apps/saas/src/modules/app/organizations/org-settings-members.tsx:64,234` — permission checks
- `apps/saas/src/modules/app/organizations/org-settings-danger.tsx:53` — `hasPermission(ac, role, "delete:organization")`
- `apps/saas/src/modules/app/admin/admin-users-table.tsx:148,172` — `hasPermission(ac, role, PERMISSIONS.VIEW_ADMIN)`

- [ ] **Step 4: Type-check**

Run: `pnpm check-types`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(rbac): migrate all 12 role-check sites to permission checks"
```

### Task 4.4: Add permission middleware to all API modules

- [ ] **Step 1: Audit all API modules**

Read each `packages/api/src/modules/*/procedures/*.ts` — identify which use `protectedProcedure` and need `permissionProcedure`.

- [ ] **Step 2: Add permissionProcedure to each module**

| Module | Permission |
|---|---|
| `activity/*` | `view:activity` |
| `ai/*` | `use:ai` |
| `api-keys/list` | `view:api-key` |
| `api-keys/create` | `create:api-key` |
| `api-keys/delete` | `delete:api-key` |
| `api-keys/revoke` | `delete:api-key` |
| `chat/*` | `view:chat` |
| `credits/*` | `view:credit` |
| `crm/*` | `view:crm` |
| `notifications/*` | `view:notification` |
| `organizations/list` | `view:organization` |
| `organizations/create` | `create:organization` |
| `organizations/get` | `view:organization` |
| `organizations/update` | `update:organization` |
| `organizations/delete` | `delete:organization` |
| `payments/*` | `view:payment` |
| `storage/*` | `view:storage` |
| `users/get` | `view:user` |
| `users/update` | `update:user` |
| `webhooks/*` | `view:webhook` |

- [ ] **Step 3: Type-check + test**

Run: `pnpm check-types && pnpm test --filter @fuutu/api`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/modules/
git commit -m "feat(api): add permission middleware to all API modules"
```

### Task 4.5: Create enforce-permissions test (abschaltbar)

- [ ] **Step 1: Write enforce test**

Create `packages/rbac/src/__tests__/enforce-permissions.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ENFORCE = process.env.RBAC_ENFORCE_PERMISSIONS !== "false";

const ROLE_CHECK_PATTERNS = [
  /\.role\s*===/,
  /\.role\s*!==/,
  /hasRoleAtLeast\(/,
  /isAdmin\(/,
  /["']admin["']\s*===/,
  /["']owner["']\s*===/,
];

const SCAN_DIRS = [
  "apps/saas/src",
  "packages/api/src",
  "packages/auth/src",
];

const SKIP_DIRS = [
  "packages/rbac/src",        // primitives use roles internally
  "__tests__",                // test files
  "node_modules",
];

describe.skipIf(!ENFORCE)("RBAC permission enforcement", () => {
  it("should not have role-check patterns in production code", () => {
    const violations: string[] = [];
    for (const dir of SCAN_DIRS) {
      scanDir(join(process.cwd(), dir), violations);
    }
    expect(violations, `Role-check patterns found:\n${violations.join("\n")}`).toEqual([]);
  });
});

function scanDir(dirPath: string, violations: string[]) {
  // Recursive scan, skip SKIP_DIRS, check each .ts/.tsx file for ROLE_CHECK_PATTERNS
  // Report file:line for each match
}
```

- [ ] **Step 2: Run test**

Run: `RBAC_ENFORCE_PERMISSIONS=true pnpm test --filter @fuutu/rbac`
Expected: PASS (all role-checks have been migrated in Task 4.3)

- [ ] **Step 3: Run with enforcement off**

Run: `RBAC_ENFORCE_PERMISSIONS=false pnpm test --filter @fuutu/rbac`
Expected: PASS (test skipped)

- [ ] **Step 4: Commit**

```bash
git add packages/rbac/src/__tests__/enforce-permissions.test.ts
git commit -m "test(rbac): add enforce-permissions test (abschaltbar via env)"
```

### Task 4.6: Phase 4 Verification Loop

- [ ] **Step 1: Run all checks**

Run: `pnpm check && pnpm check-types && pnpm build`
Expected: ALL PASS

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Run E2E**

Run: `pnpm test:e2e:saas`
Expected: ALL PASS (admin can access admin, member cannot)

- [ ] **Step 4: Browser verification — RBAC critical paths**

Start `pnpm dev:saas`, drive Playwright MCP:
- Login as admin → access admin panel → verify works
- Login as member → try admin route → verify FORBIDDEN
- Organization management → invite/remove/update members → verify permission checks
- Check console for ZERO errors on all routes

- [ ] **Step 5: Loop decision**

- ALL green → Phase 4 DONE, proceed to Phase 5
- ANY red → fix, go back to Step 1

---

## Phase 5: AI — OpenRouter as Primary Provider

### Context

**Current state:** `AIProvider` interface in `types.ts` has `chat()` + `stream()`. Google is active provider. `provider.ts` resolves via `aiConfig.provider`. Config reads `env.AI_PROVIDER` + `env.AI_MODEL`.

**Target state:** OpenRouter is default provider, uses `@ai-sdk/openai` with `baseURL: 'https://openrouter.ai/api/v1'`. Per-request model selection via `AIChatOptions.model`.

**Prerequisite:** User provides OpenRouter API key for testing.

**Files:**
- Create: `packages/ai/src/providers/openrouter.ts`
- Modify: `packages/ai/src/types.ts` (add `model` to `AIChatOptions`)
- Modify: `packages/ai/src/config.ts` (add openrouter config, change default)
- Modify: `packages/ai/src/provider.ts` (add openrouter to switch)
- Modify: `packages/ai/package.json` (add `@ai-sdk/openai` dep)
- Modify: `pnpm-workspace.yaml` (add `@ai-sdk/openai` to catalog if not there)
- Modify: `packages/env/src/saas.ts` (add OPENROUTER_* env vars)
- Test: `packages/ai/src/__tests__/openrouter-provider.test.ts`

### Task 5.1: Add @ai-sdk/openai dependency

- [ ] **Step 1: Check if @ai-sdk/openai is already in catalog**

Read `pnpm-workspace.yaml` — search for `@ai-sdk/openai`.

- [ ] **Step 2: Add to catalog if missing**

```yaml
"@ai-sdk/openai": ^1.0.0
```
(Check latest stable version via `pnpm info @ai-sdk/openai version`)

- [ ] **Step 3: Add to packages/ai/package.json**

```json
"@ai-sdk/openai": "catalog:"
```

- [ ] **Step 4: Install**

Run: `pnpm install`

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml packages/ai/package.json pnpm-lock.yaml
git commit -m "feat(ai): add @ai-sdk/openai dependency for OpenRouter"
```

### Task 5.2: Add OpenRouter env vars

- [ ] **Step 1: Add env vars to saas.ts**

```typescript
AI_PROVIDER: z.enum(["openrouter", "google", "openai", "anthropic", "noop"]).default("openrouter"),
AI_MODEL: z.string().default("~openai/gpt-latest"),
OPENROUTER_API_KEY: z.string().optional(),
OPENROUTER_HTTP_REFERER: z.string().url().optional(),
OPENROUTER_APP_TITLE: z.string().default("Fuutu Stack"),
```

Add to `runtimeEnv`:
```typescript
AI_PROVIDER: process.env.AI_PROVIDER,
AI_MODEL: process.env.AI_MODEL,
OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
OPENROUTER_HTTP_REFERER: process.env.OPENROUTER_HTTP_REFERER,
OPENROUTER_APP_TITLE: process.env.OPENROUTER_APP_TITLE,
```

- [ ] **Step 2: Type-check**

Run: `pnpm check-types --filter @fuutu/env`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/env/src/saas.ts
git commit -m "feat(env): add OpenRouter env vars, change AI_PROVIDER default"
```

### Task 5.3: Add model to AIChatOptions

- [ ] **Step 1: Read current types**

Read `packages/ai/src/types.ts`.

- [ ] **Step 2: Add model to AIChatOptions**

```typescript
export interface AIChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/types.ts
git commit -m "feat(ai): add per-request model selection to AIChatOptions"
```

### Task 5.4: Create OpenRouter provider

- [ ] **Step 1: Read google provider for pattern**

Read `packages/ai/src/providers/google.ts` — understand how `chat()` and `stream()` are implemented.

- [ ] **Step 2: Write openrouter.ts**

Create `packages/ai/src/providers/openrouter.ts`:
```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { aiConfig } from "../config.js";
import type { AIProvider, AIMessage, AIChatOptions, AIChatResponse } from "../types.js";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: aiConfig.openrouter.apiKey,
  headers: {
    "HTTP-Referer": aiConfig.openrouter.httpReferer,
    "X-OpenRouter-Title": aiConfig.openrouter.appTitle,
  },
});

export const openrouterProvider: AIProvider = {
  id: "openrouter",
  async chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResponse> {
    const model = options?.model ?? aiConfig.model;
    const result = await generateText({
      model: openrouter(model),
      messages,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });
    return {
      content: result.text,
      role: "assistant",
    };
  },
  async stream(messages: AIMessage[], options?: AIChatOptions): Promise<ReadableStream<Uint8Array>> {
    const model = options?.model ?? aiConfig.model;
    const result = streamText({
      model: openrouter(model),
      messages,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });
    return result.toUIMessageStreamResponse().body!;
  },
};
```

**Adapt to actual AI SDK API** — read `node_modules/ai/dist/index.d.ts` and `node_modules/@ai-sdk/openai/dist/index.d.ts` for exact signatures.

- [ ] **Step 3: Write test**

```typescript
import { describe, it, expect } from "vitest";
import { openrouterProvider } from "../providers/openrouter";

describe("openrouterProvider", () => {
  it("should have id 'openrouter'", () => {
    expect(openrouterProvider.id).toBe("openrouter");
  });
  it("should have chat method", () => {
    expect(typeof openrouterProvider.chat).toBe("function");
  });
  it("should have stream method", () => {
    expect(typeof openrouterProvider.stream).toBe("function");
  });
});
```

- [ ] **Step 4: Run test**

Run: `pnpm test --filter @fuutu/ai`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/providers/openrouter.ts packages/ai/src/__tests__/openrouter-provider.test.ts
git commit -m "feat(ai): add OpenRouter provider using @ai-sdk/openai"
```

### Task 5.5: Update config + provider resolver

- [ ] **Step 1: Update config.ts**

```typescript
export const aiConfig = {
  provider: env.AI_PROVIDER,
  model: env.AI_MODEL,
  openrouter: {
    apiKey: env.OPENROUTER_API_KEY,
    httpReferer: env.OPENROUTER_HTTP_REFERER ?? getBaseUrl(),
    appTitle: env.OPENROUTER_APP_TITLE,
  },
} as const;
```

- [ ] **Step 2: Update provider.ts**

Add `openrouter` to the switch:
```typescript
case "openrouter": return openrouterProvider;
```

- [ ] **Step 3: Type-check**

Run: `pnpm check-types`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/config.ts packages/ai/src/provider.ts
git commit -m "feat(ai): switch default provider to OpenRouter"
```

### Task 5.6: Real API test (requires user's API key)

- [ ] **Step 1: Set up .env with OpenRouter API key**

User provides `OPENROUTER_API_KEY=sk-or-v1-...`. Add to `.env` or `.env.local`.

- [ ] **Step 2: Start dev server**

Run: `pnpm dev:saas`

- [ ] **Step 3: Test AI chat end-to-end**

Drive Playwright MCP:
- Login → navigate to chat
- Send a message
- Verify response comes back (not an error)
- Verify streaming works (response streams in)
- Check console for ZERO errors

- [ ] **Step 4: Test model switching**

If the chat UI supports model selection, test switching models. Otherwise, test via API directly.

- [ ] **Step 5: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(ai): OpenRouter integration fixes from real API testing"
```

### Task 5.7: Phase 5 Verification Loop

- [ ] **Step 1: Run all checks**

Run: `pnpm check && pnpm check-types && pnpm build`
Expected: ALL PASS

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Run E2E**

Run: `pnpm test:e2e:saas`
Expected: ALL PASS

- [ ] **Step 4: Browser verification with real API key**

Drive Playwright MCP through chat flow — verify real responses from OpenRouter.

- [ ] **Step 5: Loop decision**

- ALL green → Phase 5 DONE, proceed to Phase 6
- ANY red → fix, go back to Step 1

---

## Phase 6: Cron — Swappable JobRunner Interface

### Context

**Current state:** `packages/cron/src/runner.ts` runs jobs sequentially in-process via a `for` loop. 4 jobs: webhook-retry, audit-log-cleanup, subscription-reminder, telemetry-ping. No external runner support.

**Target state:** `JobRunner` interface, `InProcessRunner` (default) + `TriggerDevRunner` (external). Config-driven selection.

**Files:**
- Create: `packages/cron/src/types.ts` (JobRunner interface)
- Create: `packages/cron/src/runners/in-process.ts`
- Create: `packages/cron/src/runners/trigger-dev.ts`
- Modify: `packages/cron/src/runner.ts` (refactor to use JobRunner)
- Modify: `packages/cron/src/config.ts` (add runner config)
- Modify: `packages/cron/src/index.ts` (resolveRunner)
- Modify: `packages/cron/package.json` (add @trigger.dev/sdk as optional dep)
- Modify: `pnpm-workspace.yaml` (add @trigger.dev/sdk to catalog)
- Modify: `packages/env/src/saas.ts` (add CRON_RUNNER, TRIGGER_DEV_*)

### Task 6.1: Add Trigger.dev dependency + env vars

- [ ] **Step 1: Add @trigger.dev/sdk to catalog**

```yaml
"@trigger.dev/sdk": ^3.0.0
```
(Check latest stable version)

- [ ] **Step 2: Add to packages/cron/package.json as optional dep**

```json
"@trigger.dev/sdk": "catalog:"
```

- [ ] **Step 3: Add env vars**

```typescript
CRON_RUNNER: z.enum(["in-process", "trigger-dev"]).default("in-process"),
TRIGGER_DEV_API_KEY: z.string().optional(),
TRIGGER_DEV_ENDPOINT: z.string().url().default("https://api.trigger.dev"),
```

- [ ] **Step 4: Install + type-check**

Run: `pnpm install && pnpm check-types --filter @fuutu/env`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml packages/cron/package.json packages/env/src/saas.ts pnpm-lock.yaml
git commit -m "feat(cron): add Trigger.dev dependency and env vars"
```

### Task 6.2: Create JobRunner interface + InProcessRunner

- [ ] **Step 1: Write types.ts**

Create `packages/cron/src/types.ts`:
```typescript
export interface JobDefinition {
  id: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled: boolean;
}

export interface JobRunner {
  readonly id: string;
  registerJob(job: JobDefinition): void;
  start(): void;
  stop(): void;
}
```

- [ ] **Step 2: Write InProcessRunner**

Create `packages/cron/src/runners/in-process.ts`:
```typescript
import type { JobRunner, JobDefinition } from "../types.js";

export class InProcessRunner implements JobRunner {
  readonly id = "in-process";
  private jobs: JobDefinition[] = [];
  private intervals: NodeJS.Timeout[] = [];

  registerJob(job: JobDefinition): void {
    this.jobs.push(job);
  }

  start(): void {
    for (const job of this.jobs) {
      if (!job.enabled) continue;
      // Parse cron expression, set interval
      // Use a simple cron parser or node-cron
      const interval = setInterval(() => {
        job.handler().catch(console.error);
      }, this.cronToMs(job.schedule));
      this.intervals.push(interval);
    }
  }

  stop(): void {
    for (const interval of this.intervals) clearInterval(interval);
    this.intervals = [];
  }

  private cronToMs(schedule: string): number {
    // Simple conversion for common patterns
    // Or use a cron parser library
    // For now, parse basic patterns like "*/5 * * * *"
    return 60000; // placeholder — implement proper cron parsing
  }
}
```

- [ ] **Step 3: Write TriggerDevRunner**

Create `packages/cron/src/runners/trigger-dev.ts`:
```typescript
import type { JobRunner, JobDefinition } from "../types.js";
import { cronConfig } from "../config.js";

export class TriggerDevRunner implements JobRunner {
  readonly id = "trigger-dev";
  private jobs: JobDefinition[] = [];

  registerJob(job: JobDefinition): void {
    this.jobs.push(job);
  }

  start(): void {
    // Dynamic import to avoid loading Trigger.dev SDK when not used
    import("@trigger.dev/sdk").then(({ TriggerClient, task }) => {
      const client = new TriggerClient({
        id: "fuutu-stack",
        apiKey: cronConfig.triggerDev.apiKey,
        endpoint: cronConfig.triggerDev.endpoint,
      });
      for (const job of this.jobs) {
        if (!job.enabled) continue;
        // Register task with schedule
      }
      client.start();
    });
  }

  stop(): void {
    // Trigger.dev handles this
  }
}
```

- [ ] **Step 4: Write tests**

Test that `InProcessRunner` registers and runs jobs. Test that `resolveRunner()` returns correct runner.

- [ ] **Step 5: Commit**

```bash
git add packages/cron/src/types.ts packages/cron/src/runners/ packages/cron/src/__tests__/
git commit -m "feat(cron): add JobRunner interface with InProcess + TriggerDev runners"
```

### Task 6.3: Refactor config + index to use resolveRunner

- [ ] **Step 1: Update config.ts**

```typescript
export const cronConfig = {
  runner: env.CRON_RUNNER,
  triggerDev: {
    apiKey: env.TRIGGER_DEV_API_KEY,
    endpoint: env.TRIGGER_DEV_ENDPOINT,
  },
  jobs: {
    webhookRetry: env.CRON_JOB_WEBHOOK_RETRY ?? true,
    auditLogCleanup: env.CRON_JOB_AUDIT_CLEANUP ?? true,
    subscriptionReminder: env.CRON_JOB_SUBSCRIPTION_REMINDER ?? true,
    telemetryPing: env.CRON_JOB_TELEMETRY ?? true,
  },
} as const;
```

- [ ] **Step 2: Update index.ts with resolveRunner**

```typescript
function resolveRunner(): JobRunner {
  switch (cronConfig.runner) {
    case "trigger-dev": return new TriggerDevRunner();
    case "in-process":
    default: return new InProcessRunner();
  }
}

export const runner = resolveRunner();
// Register all jobs with the runner
for (const job of jobs) {
  runner.registerJob(job);
}
```

- [ ] **Step 3: Type-check + test**

Run: `pnpm check-types && pnpm test --filter @fuutu/cron`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/cron/src/config.ts packages/cron/src/index.ts
git commit -m "feat(cron): config-driven runner resolution"
```

### Task 6.4: Phase 6 Verification Loop

- [ ] **Step 1: Run all checks**

Run: `pnpm check && pnpm check-types && pnpm build`
Expected: ALL PASS

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Run E2E**

Run: `pnpm test:e2e:saas`
Expected: ALL PASS

- [ ] **Step 4: Browser verification**

Start `pnpm dev:saas`, verify cron jobs still register and run. Check console for ZERO errors.

- [ ] **Step 5: Loop decision**

- ALL green → Phase 6 DONE, proceed to Phase 7
- ANY red → fix, go back to Step 1

---

## Phase 7: Utils — Move Framework-Coupled Hook

### Context

**Current state:** `packages/utils/src/use-locale-theme-image.ts` imports `next-intl` + `next-themes`. Breaks framework-agnostic rule.

**Target state:** Move to `apps/saas/src/modules/shared/hooks/`.

**Files:**
- Move: `packages/utils/src/use-locale-theme-image.ts` → `apps/saas/src/modules/shared/hooks/use-locale-theme-image.ts`
- Modify: `packages/utils/src/index.ts` (remove export)
- Modify: `packages/utils/package.json` (remove export)
- Modify: any imports of `use-locale-theme-image` from `@fuutu/utils`

### Task 7.1: Move the hook

- [ ] **Step 1: Find all imports**

Grep for `use-locale-theme-image` across the codebase.

- [ ] **Step 2: Move file**

```bash
mkdir -p apps/saas/src/modules/shared/hooks
mv packages/utils/src/use-locale-theme-image.ts apps/saas/src/modules/shared/hooks/use-locale-theme-image.ts
```

- [ ] **Step 3: Update imports**

Update all import sites to use the new path (relative import in saas, not `@fuutu/utils`).

- [ ] **Step 4: Remove from utils exports**

Remove from `packages/utils/src/index.ts` and `packages/utils/package.json` exports.

- [ ] **Step 5: Type-check**

Run: `pnpm check-types`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(utils): move use-locale-theme-image to apps/saas (framework-coupled)"
```

### Task 7.2: Phase 7 Verification Loop

- [ ] **Step 1: Run all checks**

Run: `pnpm check && pnpm check-types && pnpm build`
Expected: ALL PASS

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Loop decision**

- ALL green → Phase 7 DONE, proceed to Final Verification
- ANY red → fix, go back to Step 1

---

## Final Full Verification (after all 7 phases)

This is the COMPLETE manual sweep. Every route, every feature, zero tolerance for console errors.

- [ ] **Step 1: Full check suite**

Run: `pnpm check && pnpm check-types && pnpm build`
Expected: ALL PASS

- [ ] **Step 2: Full E2E suite**

Run: `pnpm test:e2e:saas && pnpm test:e2e:marketing`
Expected: ALL PASS

- [ ] **Step 3: Full Playwright MCP browser sweep — SaaS**

Start `pnpm dev:saas`, drive Playwright MCP through EVERY route:
- `/` (redirect to dashboard or login)
- `/auth/login`, `/auth/register`, `/auth/forgot-password`
- `/dashboard`
- `/settings` (profile, security, api-keys, webhooks, notifications)
- `/admin` (users, audit logs)
- `/organizations` (list, create, settings, members, danger zone)
- `/billing` (plans, invoices)
- `/chat` (AI chat — verify OpenRouter works)
- `/crm` (if exists)
- `/notifications`
- `/onboarding`
- `/api/[[...rest]]` (verify API responds)

For EACH route:
- Page renders without blank screen
- Console has ZERO errors and ZERO warnings
- No hydration mismatches
- Network requests succeed (no 4xx/5xx)

- [ ] **Step 4: Full Playwright MCP browser sweep — Marketing**

Start `pnpm dev:marketing`, drive Playwright MCP:
- `/` (home)
- `/pricing`
- `/blog` + `/blog/[slug]`
- `/changelog`
- `/legal/[slug]`
- `/contact`

For EACH route: zero console errors.

- [ ] **Step 5: Full Playwright MCP browser sweep — Docs**

Start docs app, drive Playwright MCP:
- All doc pages render
- Zero console errors

- [ ] **Step 6: Storage smoke test**

With MinIO running (`pnpm db:start`):
- Upload a file via API or UI
- Download it
- Stream it
- Delete it
- List objects

- [ ] **Step 7: Logs smoke test**

- Verify evlog output in dev mode (pretty)
- Verify evlog output in production mode (JSON)
- Verify audit sink writes to DB

- [ ] **Step 8: AI smoke test**

With OpenRouter API key:
- Chat: send message, get response
- Stream: send message, verify streaming works
- Model switching: change model, verify different model responds

- [ ] **Step 9: RBAC smoke test**

- Admin user: can access admin panel, all API endpoints
- Member user: cannot access admin, gets FORBIDDEN
- Org member: can access org resources
- Non-org member: cannot access org resources

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "feat: modularity rework complete — all 7 phases verified"
```

- [ ] **Step 11: Report**

Report to user:
- All 7 phases complete
- All checks green
- All E2E passing
- All browser routes clean
- All smoke tests passing
- Ready for review/merge

---

## Summary

| Phase | Package | Key Change | Est. Tasks |
|---|---|---|---|
| 1 | Logs | config.ts + evlog default | 7 |
| 2 | Storage | S3-compatible provider + stream in interface | 7 |
| 3 | Analytics | getScriptProps in interface | 5 |
| 4 | RBAC | AccessPolicy + permission middleware + migration + enforce-test | 6 |
| 5 | AI | OpenRouter provider | 7 |
| 6 | Cron | JobRunner interface + Trigger.dev | 4 |
| 7 | Utils | Move framework-coupled hook | 2 |
| **Final** | **All** | **Full verification sweep** | **11** |

**Total: ~49 tasks across 7 phases + final verification**

Every phase has its own Build-Test-Verify loop. No phase starts until the previous one is fully green. The final verification is a complete sweep of everything.
