# Modularity & Provider-Swappability Rework

> **Date:** 2026-08-20
> **Status:** Design — pending user approval
> **Scope:** 7 packages need rework to reach the Fuutu Stack's modularity standard. Every external integration must be config-driven and provider-swappable. RBAC must run on permissions, not roles.

---

## Context

The initial audit (2026-08-19) confirmed: api, auth, db, i18n, payments are SOLID. 21 of 24 packages are production-ready. But 3 provider-swappable domains (logs, storage, analytics) don't fully meet the swappability standard, RBAC's permission infrastructure is completely unwired, AI needs OpenRouter as primary provider, Cron needs external runner support, and utils has a framework-coupling leak.

This spec covers all 7 rework topics in dependency order.

---

## Decisions (confirmed with user)

| Topic | Decision |
|---|---|
| AI / OpenRouter | AI SDK's `@ai-sdk/openai` provider pointed at OpenRouter (no new SDK dep) |
| Logs | evlog as default provider behind our `LogProvider` interface + add `config.ts` |
| Cron | Swappable `JobRunner` interface: `in-process` (default) + `trigger-dev` |
| Ultracite | Skip — keep Biome as-is |
| RBAC | Full migration: AccessPolicy + API middleware + app migration + enforce-test |
| Storage | One S3-compatible provider with `forcePathStyle` + `endpoint` config |
| Utils | Move `use-locale-theme-image` out of framework-agnostic utils |

---

## Implementation Order

1. **Logs** — foundational, everything depends on logging
2. **Storage** — self-contained provider-pattern fix
3. **Analytics** — same pattern as storage, small
4. **RBAC** — biggest block, security-critical, no deps on 1-3
5. **AI** — OpenRouter provider, needs API key for testing
6. **Cron** — architecturally new (Trigger.dev integration)
7. **Utils** — trivial, fold in last

---

## 1. Logs — Config-Driven + evlog Default

### Problem
- No `config.ts` — provider selection is not config-driven
- Requires manual `setLogProvider()` / `setAuditSink()` calls in app code
- Breaks the "swap provider via config, everything else works" promise

### Design

**New file: `packages/logs/src/config.ts`**
```ts
export type LogProviderId = "evlog" | "console" | "pino" | "axiom" | "noop";
export type AuditSinkId = "console" | "db" | "axiom" | "noop";

export const logsConfig = {
  provider: env.LOG_PROVIDER ?? "evlog",
  auditSink: env.LOG_AUDIT_SINK ?? "console",
  level: env.LOG_LEVEL ?? "info",
};
```

**Refactor `packages/logs/src/index.ts`:**
- Remove `setLogProvider()` / `setAuditSink()` manual registration
- Add `resolveLogProvider()` — reads `logsConfig.provider`, instantiates the matching provider (same pattern as `packages/ai/src/provider.ts`)
- Auto-initialize on module load (no app-code registration needed)
- Keep `setLogProvider()` as escape hatch for advanced users, but not required for default flow

**New default provider: `packages/logs/src/providers/evlog.ts`**
- Wraps `evlog` package
- Implements `LogProvider.log(level, message, context)` → maps to evlog's `log.info/error/warn/debug`
- Structured context passed through
- Pretty output in dev, JSON in production (evlog handles this)

**Keep existing providers:**
- `console.ts` — fallback for local dev / no-dep setups
- `pino.ts` — skeleton (kept for users who want pino specifically)
- `axiom.ts` — skeleton for external log shipping

**New audit sink: `packages/logs/src/sinks/db.ts`**
- Writes audit events to `@fuutu/db` audit table
- Implements `AuditSink.record(event)`

**Env vars (added to `packages/env/src/saas.ts`):**
- `LOG_PROVIDER` (default: `evlog`)
- `LOG_AUDIT_SINK` (default: `console`)
- `LOG_LEVEL` (default: `info`)

### Migration
- Find any `setLogProvider()` / `setAuditSink()` calls in apps/saas (audit found 0 — nothing to migrate)
- Verify `@fuutu/logs` consumers (`createLogger({ scope })`) still work unchanged — the public API stays the same, only initialization changes

### Testing
- Unit test: `resolveLogProvider()` returns correct provider for each config value
- Unit test: evlog provider maps levels correctly
- Unit test: fallback to console when provider fails to initialize

---

## 2. Storage — One S3-Compatible Provider

### Problem
- `getObjectStream()` in `index.ts:58` hardcodes S3 check, throws for other providers
- `getObjectStream` not in `StorageProvider` interface
- No `forcePathStyle` / custom endpoint config for Hetzner/MinIO compatibility

### Design

**Extend `StorageProvider` interface (`packages/storage/src/types.ts`):**
```ts
interface StorageProvider {
  readonly id: string;
  getSignedUploadUrl(input: SignedUploadInput): Promise<SignedUploadResult>;
  getSignedDownloadUrl(input: SignedDownloadInput): Promise<string>;
  deleteObject(bucket: string, key: string): Promise<void>;
  listObjects(bucket: string, prefix?: string): Promise<StorageObject[]>;
  getObjectStream?(bucket: string, key: string): Promise<StorageStreamResult>;
}
```
`getObjectStream` is optional — providers that don't support streaming return `undefined` or throw a typed error.

**Refactor S3 provider (`packages/storage/src/providers/s3.ts`):**
- Add `forcePathStyle` config option (default: `true` — needed for MinIO, Hetzner, R2)
- Add `endpoint` config option (custom S3-compatible endpoint)
- Add `region` config option (default: `"auto"`)
- Move `fetchObjectStream()` into the provider class/object as `getObjectStream()` method
- Client initialization: `new S3Client({ endpoint, region, forcePathStyle, credentials })`

**Update `packages/storage/src/config.ts`:**
```ts
export const storageConfig = {
  provider: env.STORAGE_PROVIDER ?? "s3",
  s3: {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION ?? "auto",
    forcePathStyle: env.S3_FORCE_PATH_STYLE ?? true,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
};
```

**Remove R2 skeleton** — R2 is S3-compatible. Users configure the S3 provider with R2's endpoint + `forcePathStyle: true`.

**Keep Supabase skeleton** — Supabase has its own storage API, not S3-compatible.

**Refactor `packages/storage/src/index.ts`:**
- Remove hardcoded `getObjectStream` — delegate to `provider.getObjectStream?.()`
- If provider doesn't implement `getObjectStream`, throw a typed `StorageStreamUnavailableError`

**Env vars (added to `packages/env/src/saas.ts`):**
- `STORAGE_PROVIDER` (default: `s3`)
- `S3_ENDPOINT` (required for non-AWS)
- `S3_REGION` (default: `auto`)
- `S3_FORCE_PATH_STYLE` (default: `true`)
- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (already exist)

### Testing
- Unit test: S3 provider initializes with `forcePathStyle: true` + custom endpoint
- Unit test: `getObjectStream` delegates to provider method
- Unit test: non-streaming provider throws `StorageStreamUnavailableError`
- Integration test: MinIO (local Docker) — upload, download, stream, delete, list
- Integration test: Hetzner S3 (if credentials available) — same operations

### Local dev setup
- Docker Compose already has MinIO — verify `S3_ENDPOINT=http://localhost:9000` works
- Document the MinIO + Hetzner config in the storage package README

---

## 3. Analytics — Script Injection via Interface

### Problem
- `script.tsx:36-42` hardcodes Umami script loader, warns for other providers
- Script injection not part of the `AnalyticsProvider` interface

### Design

**Extend `AnalyticsProvider` interface (`packages/analytics/src/types.ts`):**
```ts
interface AnalyticsProvider {
  readonly id: AnalyticsProviderId;
  trackEvent(name: string, props?: AnalyticsEventProps): void;
  trackPageview(url?: string): void;
  getScriptProps?(): AnalyticsScriptProps | null;
}
```
`getScriptProps()` returns the props for the `<Script>` tag (src, data attributes, etc.) or `null` for server-side-only analytics (no script needed).

**Refactor Umami provider (`packages/analytics/src/providers/umami.ts`):**
- Implement `getScriptProps()` → returns `{ src: umamiScriptUrl, dataWebsiteId, strategy: "afterInteractive" }`

**Refactor `packages/analytics/src/script.tsx`:**
- Call `provider.getScriptProps()` — if `null`, render nothing
- If props returned, render `<Script {...props} />`
- Remove hardcoded umami check
- Consent check stays in `script.tsx` (it's cross-provider)

**Add `getScriptProps()` to all skeleton providers:**
- `plausible.ts`, `pirsch.ts`, `mixpanel.ts`, `ga4.ts` — each returns its own script props
- `noop.ts` — returns `null`

### Testing
- Unit test: each provider returns correct script props
- Unit test: `script.tsx` renders correct `<Script>` for active provider
- Unit test: noop provider renders nothing
- Browser verification: Umami script loads without console errors

---

## 4. RBAC — Permission-Based Authorization (Full Migration)

### Problem
- 12 role-check sites in production code, 0 permission-check sites
- Permission infrastructure (`AccessControl`, `hasPermission`, `canCRUD`) exists but is completely unwired
- No `AccessControl` instance or `AccessPolicy` defined anywhere
- 11 of 12 API modules have only `protectedProcedure` (auth-only, no authorization)
- No test enforces permission-based checks

### Design

#### 4a. Central AccessPolicy (`packages/rbac/src/policy.ts`)

Define which permissions each role has:
```ts
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
    // view-only on organizations
    "view:organization",
  ],
  admin: [
    ...createResourcePermissions("organization"),
    ...createResourcePermissions("user"),
    ...createResourcePermissions("audit-log"),
    ...createResourcePermissions("payment"),
    ...createResourcePermissions("admin"),
    // inherits all member permissions
  ],
  owner: [
    // inherits all admin permissions
    "delete:organization",
    "manage:billing",
  ],
};
```
Policy is additive — admin inherits member permissions, owner inherits admin.

**Note on non-CRUD permissions:** `createResourcePermissions()` generates CRUD actions (view/create/update/delete). The policy can also include custom permissions not generated by this helper — e.g. `"use:ai"`, `"manage:billing"`, `"invite:organization"`. These are plain strings in the policy, typed via a `Permission` union type exported from the rbac package.

#### 4b. Permission Middleware (`packages/api/src/orpc/procedures.ts`)

New procedure builder:
```ts
export function permissionProcedure(permission: string) {
  return protectedProcedure.use(async ({ context, next }) => {
    const role = toRbacRole(context.session.user.role);
    const ac = new AccessControl(DEFAULT_ACCESS_POLICY);
    if (!hasPermission(ac, role, permission)) {
      throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
    }
    return next({ context });
  });
}
```

Also add org-scoped permission check:
```ts
export function requireOrgPermission(orgId: string, permission: string) {
  // checks permission against the user's role WITHIN the org
}
```

#### 4c. Migrate All 12 Role-Check Sites

| File | Current | New |
|---|---|---|
| `api/orpc/procedures.ts:28-29` | `hasRoleAtLeast(role, "admin")` | `permissionProcedure("view:admin")` |
| `api/modules/organizations/shared.ts:40` | `hasRoleAtLeast(role, minRole)` | `requireOrgPermission(orgId, permission)` |
| `api/modules/organizations/members/procedures/invite.ts:27` | `input.role === "owner"` | `requireOrgPermission(orgId, "invite:organization")` |
| `api/modules/organizations/members/procedures/remove.ts:45,48-50` | role comparisons | `requireOrgPermission(orgId, "remove:organization")` |
| `api/modules/organizations/members/procedures/update-role.ts:37` | `input.role !== "owner"` | `requireOrgPermission(orgId, "update:organization")` |
| `auth/types.ts:38,46` | `toRbacRole` / `isAdmin` | `hasPermission(ac, role, "view:admin")` |
| `saas/lib/auth-server.ts:42` | `isAdmin(session.user)` | `requirePermission(session, "view:admin")` |
| `saas/modules/app/components/sidebar.tsx:37` | `isAdmin(user)` | `hasPermission(ac, role, "view:admin")` |
| `saas/modules/app/organizations/org-settings-members.tsx:234,64` | role comparisons | permission checks |
| `saas/modules/app/organizations/org-settings-danger.tsx:53` | `hasRoleAtLeast(role, "owner")` | `hasPermission(ac, role, "delete:organization")` |
| `saas/modules/app/admin/admin-users-table.tsx:148,172` | `hasRoleAtLeast(role, "admin")` | `hasPermission(ac, role, "view:admin")` |

#### 4d. Add Permission Middleware to All API Modules

Every API module currently using only `protectedProcedure` gets a `permissionProcedure`:
- `modules/activity/*` → `permissionProcedure("view:activity")`
- `modules/ai/*` → `permissionProcedure("use:ai")`
- `modules/api-keys/*` → `permissionProcedure("view:api-key")` (list), `permissionProcedure("create:api-key")` (create), etc.
- `modules/chat/*` → `permissionProcedure("view:chat")`
- `modules/credits/*` → `permissionProcedure("view:credit")`
- `modules/crm/*` → `permissionProcedure("view:crm")`
- `modules/notifications/*` → `permissionProcedure("view:notification")`
- `modules/organizations/procedures/*` → `permissionProcedure("view:organization")` (read), `permissionProcedure("create:organization")` (create), etc.
- `modules/payments/*` → `permissionProcedure("view:payment")`
- `modules/storage/*` → `permissionProcedure("view:storage")`
- `modules/users/*` → `permissionProcedure("view:user")`
- `modules/webhooks/*` → `permissionProcedure("view:webhook")`

#### 4e. Enforce-Test (Abschaltbar)

New test: `packages/rbac/src/__tests__/enforce-permissions.test.ts`

Scans all `.ts`/`.tsx` files in `apps/saas/src` and `packages/api/src` for role-check patterns:
- `.role ===`
- `.role !==`
- `hasRoleAtLeast(`
- `isAdmin(`
- String comparisons against `"admin"`, `"owner"`, `"member"`

**Abschaltbar via env var:** `RBAC_ENFORCE_PERMISSIONS=true` (default: `true`). When `false`, the test is skipped — for users who want role-only checks in their app code.

The test does NOT flag:
- `packages/rbac/src/*` itself (the primitives use roles internally — that's correct)
- `packages/auth/src/types.ts` `toRbacRole()` (normalization, not a check)
- Test files

**`isAdmin` removal:** The current `isAdmin()` helper in `packages/auth/src/types.ts` is removed entirely. All call sites use `hasPermission(ac, role, "view:admin")` directly. This prevents the enforce-test from flagging `isAdmin(` calls — the function no longer exists.

### Testing
- Unit test: `AccessControl` with `DEFAULT_ACCESS_POLICY` — verify each role has correct permissions
- Unit test: `permissionProcedure` throws FORBIDDEN when permission missing
- Unit test: `requireOrgPermission` checks org-scoped permissions
- Enforce-test: scans codebase, fails on role-check patterns (when `RBAC_ENFORCE_PERMISSIONS=true`)
- E2E: admin can access admin endpoints, member cannot
- E2E: org member can access org resources, non-member cannot

### Not doing
- External permission systems (confirmed: overkill, permissions are always internal)
- Swappability for the AccessPolicy (it's TypeScript config, not a runtime provider)

---

## 5. AI — OpenRouter as Primary Provider

### Problem
- Google is current default, but OpenRouter is the strategic choice (hundreds of models, one API)
- Need OpenRouter as primary, others remain as skeletons

### Design

**New provider: `packages/ai/src/providers/openrouter.ts`**
- Uses `@ai-sdk/openai` (already a catalog dep or add it) with `baseURL: 'https://openrouter.ai/api/v1'`
- Passes OpenRouter attribution headers: `HTTP-Referer`, `X-OpenRouter-Title`
- Implements `chat()` and `stream()` per the existing `AIProvider` interface
- Supports per-request model selection via `AIChatOptions.model` (OpenRouter's key feature)

**Extend `AIChatOptions` (`packages/ai/src/types.ts`):**
```ts
interface AIChatOptions {
  model?: string;       // override default model per-request (OpenRouter feature)
  temperature?: number;
  maxTokens?: number;
  // ...existing options
}
```

**Update `packages/ai/src/config.ts`:**
```ts
export const aiConfig = {
  provider: env.AI_PROVIDER ?? "openrouter",  // changed from "google"
  model: env.AI_MODEL ?? "~openai/gpt-latest", // OpenRouter model slug
  openrouter: {
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    httpReferer: env.OPENROUTER_HTTP_REFERER ?? getBaseUrl(),
    appTitle: env.OPENROUTER_APP_TITLE ?? "Fuutu Stack",
  },
};
```

**Update `packages/ai/src/provider.ts`:**
- Add `openrouter` to the provider switch
- OpenRouter provider initialized with `createOpenAI({ baseURL, apiKey, headers })`

**Keep existing providers:**
- `google.ts` — remains as a working alternative (not skeleton)
- `openai.ts`, `anthropic.ts`, `noop.ts` — remain as skeletons

**Env vars (added to `packages/env/src/saas.ts`):**
- `AI_PROVIDER` (default: `openrouter`)
- `AI_MODEL` (default: `~openai/gpt-latest`)
- `OPENROUTER_API_KEY` (required when provider is openrouter)
- `OPENROUTER_HTTP_REFERER` (optional, defaults to app base URL)
- `OPENROUTER_APP_TITLE` (optional, defaults to "Fuutu Stack")

### Testing
- Unit test: OpenRouter provider initializes with correct baseURL + headers
- Unit test: `chat()` sends model from options, falls back to config default
- Unit test: `stream()` returns readable stream
- **Real API test** (user provides API key): end-to-end chat + stream against OpenRouter
- Browser verification: AI chat in SaaS app works with OpenRouter

### Dependencies
- `@ai-sdk/openai` — check if already in catalog, add if not
- No `@openrouter/sdk` — we use the OpenAI-compatible provider

---

## 6. Cron — Swappable JobRunner Interface

### Problem
- Jobs run in-process sequentially — blocks the app for long-running jobs
- No external runner support (Trigger.dev, etc.)
- Not swappable

### Design

**New interface: `packages/cron/src/types.ts`**
```ts
interface JobRunner {
  readonly id: string;
  registerJob(job: JobDefinition): void;
  start(): void;
  stop(): void;
}

interface JobDefinition {
  id: string;
  schedule: string;        // cron expression
  handler: () => Promise<void>;
  enabled: boolean;
}
```

**Refactor `packages/cron/src/runner.ts`:**
- Rename current runner to `InProcessRunner` — implements `JobRunner`
- Jobs register via `runner.registerJob(job)` instead of static array
- `InProcessRunner` uses `setInterval` / `node-cron` for scheduling (not just `runAllJobs`)

**New runner: `packages/cron/src/runners/trigger-dev.ts`**
- Implements `JobRunner` using `@trigger.dev/sdk`
- `registerJob()` → creates a Trigger.dev task with the schedule
- `start()` → connects to Trigger.dev cloud or self-hosted instance
- `handler` runs in Trigger.dev's infrastructure (no app blocking)

**New file: `packages/cron/src/config.ts`**
```ts
export const cronConfig = {
  runner: env.CRON_RUNNER ?? "in-process",
  triggerDev: {
    apiKey: env.TRIGGER_DEV_API_KEY,
    endpoint: env.TRIGGER_DEV_ENDPOINT ?? "https://api.trigger.dev",
  },
  jobs: {
    webhookRetry: env.CRON_JOB_WEBHOOK_RETRY ?? true,
    auditLogCleanup: env.CRON_JOB_AUDIT_CLEANUP ?? true,
    subscriptionReminder: env.CRON_JOB_SUBSCRIPTION_REMINDER ?? true,
    telemetryPing: env.CRON_JOB_TELEMETRY ?? true,
  },
};
```

**Resolve runner: `packages/cron/src/index.ts`**
```ts
function resolveRunner(): JobRunner {
  switch (cronConfig.runner) {
    case "trigger-dev": return new TriggerDevRunner(cronConfig.triggerDev);
    case "in-process":
    default: return new InProcessRunner();
  }
}
```

**Keep existing 4 jobs unchanged** — they just register with whichever runner is active.

**Env vars (added to `packages/env/src/saas.ts`):**
- `CRON_RUNNER` (default: `in-process`)
- `TRIGGER_DEV_API_KEY` (required when runner is `trigger-dev`)
- `TRIGGER_DEV_ENDPOINT` (optional, for self-hosted)
- `CRON_JOB_*` flags (already exist in current config)

### Testing
- Unit test: `InProcessRunner` registers and executes jobs
- Unit test: `TriggerDevRunner` creates tasks with correct schedules (mocked)
- Unit test: `resolveRunner()` returns correct runner for config
- Integration test: in-process runner runs all 4 jobs without errors

### Dependencies
- `@trigger.dev/sdk` — add to catalog (only loaded when `CRON_RUNNER=trigger-dev`)

---

## 7. Utils — Move Framework-Coupled Hook

### Problem
- `packages/utils/src/use-locale-theme-image.ts` imports `next-intl` + `next-themes`
- Breaks the "utils = framework-agnostic" rule

### Design

**Move `use-locale-theme-image.ts` to `packages/ui/src/hooks/use-locale-theme-image.ts`**
- `@fuutu/ui` is allowed to depend on Next.js ecosystem hooks (it's UI-layer)
- Actually — `@fuutu/ui` must be framework-agnostic too (no `next/*` imports per AGENTS.md §6)
- **Better: move to `apps/saas/src/modules/shared/hooks/use-locale-theme-image.ts`**
- It's an app-specific hook, not a shared utility

**Update exports:**
- Remove from `packages/utils/src/index.ts`
- Remove from `packages/utils/package.json` exports
- Add to `apps/saas` locally

### Testing
- Verify no other package imports `use-locale-theme-image` from `@fuutu/utils`
- Type-check passes after move

---

## Cross-Cutting Concerns

### Env vars summary (all added to `packages/env/src/saas.ts`)
| Var | Package | Default |
|---|---|---|
| `LOG_PROVIDER` | logs | `evlog` |
| `LOG_AUDIT_SINK` | logs | `console` |
| `LOG_LEVEL` | logs | `info` |
| `S3_ENDPOINT` | storage | (required for non-AWS) |
| `S3_REGION` | storage | `auto` |
| `S3_FORCE_PATH_STYLE` | storage | `true` |
| `AI_PROVIDER` | ai | `openrouter` (changed from `google`) |
| `AI_MODEL` | ai | `~openai/gpt-latest` |
| `OPENROUTER_API_KEY` | ai | (required when provider=openrouter) |
| `OPENROUTER_HTTP_REFERER` | ai | app base URL |
| `OPENROUTER_APP_TITLE` | ai | `Fuutu Stack` |
| `CRON_RUNNER` | cron | `in-process` |
| `TRIGGER_DEV_API_KEY` | cron | (required when runner=trigger-dev) |
| `TRIGGER_DEV_ENDPOINT` | cron | `https://api.trigger.dev` |
| `RBAC_ENFORCE_PERMISSIONS` | rbac test | `true` |

### New dependencies (all via pnpm catalog)
| Package | Dep | Why |
|---|---|---|
| `@fuutu/logs` | `evlog` | Default log provider |
| `@fuutu/ai` | `@ai-sdk/openai` | OpenRouter integration (OpenAI-compatible) |
| `@fuutu/cron` | `@trigger.dev/sdk` | External job runner (optional, lazy-loaded) |

### Kit fingerprint impact
None — no fingerprint emission points are touched.

### i18n impact
None — no user-visible strings changed. RBAC error messages use existing translation keys or add new ones if needed (en + de same commit).

---

## Verification Methodology — Build-Test-Verify Loop (non-negotiable)

Every topic goes through a strict loop until everything is green. No topic is "done" until the full loop passes. No moving to the next topic until the current one is fully verified.

### Per-Topic Loop

```
Build → Finish → Test → All Checks → Manual Browser Test
  ↑                                              │
  └────────────── if ANY fails ──────────────────┘
                     (fix, then re-run ENTIRE loop)
```

**Step-by-step per topic:**

1. **Build** — implement all changes for the topic
2. **Finish** — complete the implementation, no half-done states
3. **Test** — run `pnpm test` for the changed package(s)
4. **All Checks** — run the full verification suite:
   - `pnpm check` (Biome lint + format)
   - `pnpm check-types` (TypeScript all workspaces — ALL, not just the changed one)
   - `pnpm build` (full turbo build)
   - `pnpm test:e2e:saas` (if the topic touches UI/routes/API)
5. **Manual Browser Test** — drive Playwright MCP through every affected route:
   - Navigate to each affected page
   - Check console for errors/warnings (ZERO tolerance)
   - Verify the feature actually works (not just renders)
   - Check hydration, network requests, API responses
6. **Loop decision:**
   - ALL green → topic is DONE, move to next topic
   - ANY red → fix the issue, go back to step 3, re-run the ENTIRE loop (not just the failed step)

### Final Full Verification (after all 7 topics)

After the last topic passes its loop, run a COMPLETE manual verification of everything:

1. `pnpm check && pnpm check-types && pnpm build` — full suite
2. `pnpm test:e2e:saas` — all 13 E2E specs
3. `pnpm test:e2e:marketing` — all marketing E2E specs
4. **Full Playwright MCP browser sweep** — every route in saas + marketing + docs:
   - Login flow, dashboard, settings, admin, organizations, billing, API keys, webhooks, chat, CRM, notifications, onboarding
   - Marketing: home, pricing, blog, changelog, legal, contact
   - Docs: all doc pages
   - Zero console errors on ANY route
5. **Manual smoke test with real OpenRouter API key** (AI chat end-to-end)
6. **Storage smoke test** — upload/download/stream against local MinIO
7. **Logs smoke test** — verify evlog output in dev + production mode

Only when ALL of this is green is the rework considered complete.

### Topic Independence

Each topic is self-contained — it can be built, tested, and verified independently. Topics are ordered by dependency (logs first because everything logs), but each one produces a working, testable state. If a topic fails its loop, the previous topics remain green and committed.
