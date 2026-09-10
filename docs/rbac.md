# RBAC — Role-Based Access Control

The Fuutu Stack has **two independent role systems** that control what a user can do. Both use the same `PERMISSIONS` vocabulary but have separate hierarchies, separate policies, and separate enforcement points.

| System | Roles | Source | Enforced by |
|---|---|---|---|
| **System** | `user` → `admin` | Better-Auth `admin` plugin → `user.role` | `requireAuth()` / `requireAdmin()` in server components, `permissionProcedure()` / `authProcedure({ systemPermission })` in oRPC |
| **Org** | `member` → `admin` → `owner` | Better-Auth `organization` plugin → `member.role` | `requireOrgRole()` / `requireOrgPermissionAccess()` in oRPC handlers, `hasOrgPermission()` in client components |

**Design principle:** The org `member` base tier mirrors the system `user` base tier for resources that exist in both scopes. The `admin`/`owner` tiers add *management* capabilities (invite, update org, delete org, manage billing), not more resource access.

---

## Permission Catalog

All permissions are defined in `packages/rbac/src/permissions.ts`.

### CRUD Resources (auto-generated)

Each resource gets 4 permissions: `view`, `create`, `update`, `delete`.

```ts
PERMISSIONS.ORGANIZATION.VIEW   // "view:organization"
PERMISSIONS.ORGANIZATION.CREATE // "create:organization"
PERMISSIONS.ORGANIZATION.UPDATE // "update:organization"
PERMISSIONS.ORGANIZATION.DELETE // "delete:organization"
```

| Resource | Key | Notes |
|---|---|---|
| `api-key` | `PERMISSIONS.API_KEY.*` | User-scoped or org-scoped |
| `webhook` | `PERMISSIONS.WEBHOOK.*` | Always org-scoped |
| `notification` | `PERMISSIONS.NOTIFICATION.*` | Always user-scoped |
| `chat` | `PERMISSIONS.CHAT.*` | User-scoped or org-scoped |
| `credit` | `PERMISSIONS.CREDIT.*` | View-only for users/members |
| `storage` | `PERMISSIONS.STORAGE.*` | User-scoped or org-scoped |
| `crm` | `PERMISSIONS.CRM.*` | Org-scoped |
| `activity` | `PERMISSIONS.ACTIVITY.*` | View-only |
| `organization` | `PERMISSIONS.ORGANIZATION.*` | Create/view = user; update/delete = org admin/owner |
| `user` | `PERMISSIONS.USER.*` | Admin-only (system) |
| `audit-log` | `PERMISSIONS.AUDIT_LOG.*` | Admin-only (system) |
| `payment` | `PERMISSIONS.PAYMENT.*` | View = user; create/update = org admin |
| `admin` | `PERMISSIONS.ADMIN.*` | Admin-only (system) |

### Custom Permissions (non-CRUD)

```ts
PERMISSIONS.USE_AI                // "use:ai"
PERMISSIONS.MANAGE_BILLING        // "manage:billing" — owner only
PERMISSIONS.VIEW_ADMIN            // "view:admin" — admin only
PERMISSIONS.INVITE_ORGANIZATION   // "invite:organization" — org admin+
PERMISSIONS.REMOVE_ORGANIZATION   // "remove:organization" — org admin+
```

### Adding a New Permission

1. **CRUD resource** → add the resource name to `CRUD_RESOURCES` in `packages/rbac/src/permissions.ts`. All 4 CRUD permissions are auto-generated.
2. **Custom permission** → add to `CUSTOM_PERMISSIONS` in the same file.
3. **Grant it** → add to the appropriate role in `SYSTEM_POLICY` (`system-policy.ts`) and/or `ORG_POLICY` (`org-policy.ts`).

---

## Policy Matrix

### System Policy (`packages/rbac/src/system-policy.ts`)

| Permission | `user` | `admin` |
|---|---|---|
| API_KEY.* | ✅ | ✅ |
| CHAT.* | ✅ | ✅ |
| STORAGE.* | ✅ | ✅ |
| CRM.* | ✅ | ✅ |
| NOTIFICATION.VIEW | ✅ | ✅ |
| NOTIFICATION.UPDATE | ✅ | ✅ |
| CREDIT.VIEW | ✅ | ✅ |
| ACTIVITY.VIEW | ✅ | ✅ |
| PAYMENT.VIEW | ✅ | ✅ |
| ORGANIZATION.CREATE | ✅ | ✅ |
| ORGANIZATION.VIEW | ✅ | ✅ |
| USE_AI | ✅ | ✅ |
| USER.* | ❌ | ✅ |
| AUDIT_LOG.* | ❌ | ✅ |
| PAYMENT.CREATE | ❌ | ✅ |
| PAYMENT.UPDATE | ❌ | ✅ |
| ADMIN.* | ❌ | ✅ |
| VIEW_ADMIN | ❌ | ✅ |

### Org Policy (`packages/rbac/src/org-policy.ts`)

| Permission | `member` | `admin` | `owner` |
|---|---|---|---|
| API_KEY.* | ✅ | ✅ | ✅ |
| WEBHOOK.* | ✅ | ✅ | ✅ |
| CHAT.* | ✅ | ✅ | ✅ |
| STORAGE.* | ✅ | ✅ | ✅ |
| CRM.* | ✅ | ✅ | ✅ |
| CREDIT.VIEW | ✅ | ✅ | ✅ |
| ACTIVITY.VIEW | ✅ | ✅ | ✅ |
| PAYMENT.VIEW | ✅ | ✅ | ✅ |
| ORGANIZATION.VIEW | ✅ | ✅ | ✅ |
| ORGANIZATION.UPDATE | ❌ | ✅ | ✅ |
| INVITE_ORGANIZATION | ❌ | ✅ | ✅ |
| REMOVE_ORGANIZATION | ❌ | ✅ | ✅ |
| PAYMENT.CREATE | ❌ | ✅ | ✅ |
| PAYMENT.UPDATE | ❌ | ✅ | ✅ |
| ORGANIZATION.DELETE | ❌ | ❌ | ✅ |
| MANAGE_BILLING | ❌ | ❌ | ✅ |

---

## How to Use RBAC

### 1. Server Components / Layouts (Server-Side)

Use `requireAuth()` and `requireAdmin()` from `@/lib/auth-server` (which wraps `@fuutu/auth` + `@fuutu/rbac`):

```tsx
import { requireAuth, requireAdmin } from "@/lib/auth-server";

// Any authenticated user
export default async function DashboardPage() {
  const session = await requireAuth();
  // session.user is available
}

// Admin-only page — redirects to /dashboard?error=forbidden if not admin
export default async function AdminPage() {
  const session = await requireAdmin();
  // session.user is guaranteed to be an admin
}
```

**How it works:** `requireAdmin()` checks `userHasPermission(ac, session.user, PERMISSIONS.VIEW_ADMIN)` where `ac` is a module-level `SystemAccessControl(SYSTEM_POLICY)` instance.

### 2. oRPC API Procedures (Server-Side)

The primary enforcement layer. Use `authProcedure()` with permission options:

```ts
import { authProcedure } from "../../orpc";
import { PERMISSIONS } from "@fuutu/rbac";

// System permission only (user-scoped resource)
export const myProcedure = authProcedure({
  systemPermission: PERMISSIONS.STORAGE.CREATE,
})
  .input(mySchema)
  .handler(async ({ input, context }) => { ... });

// Org permission (org-scoped resource)
export const myOrgProcedure = authProcedure({
  org: { permission: PERMISSIONS.ORGANIZATION.UPDATE },
})
  .input(mySchema)
  .handler(async ({ input, context }) => { ... });

// Both system + org (resource exists in both scopes, org optional)
export const myDualProcedure = authProcedure({
  systemPermission: PERMISSIONS.API_KEY.CREATE,
  org: { permission: PERMISSIONS.API_KEY.CREATE, optional: true },
})
  .input(mySchema)
  .handler(async ({ input, context }) => { ... });

// Plan tier gating
export const proOnlyProcedure = authProcedure({
  org: { permission: PERMISSIONS.WEBHOOK.CREATE },
  plan: "pro",
})
  .input(mySchema)
  .handler(async ({ input, context }) => { ... });
```

**What `authProcedure()` does (in order):**
1. **Auth** — throws `UNAUTHORIZED` if no session
2. **Org resolution** — if `orgId` is in the input, fetches the org, verifies membership, checks org permission. Throws `NOT_FOUND` / `FORBIDDEN`.
3. **System permission** — if `systemPermission` is set and no org scope, checks system permission. Throws `FORBIDDEN`.
4. **Plan tier** — if `plan` is set, checks the active subscription tier. Throws `FORBIDDEN` ("This feature requires a higher plan").
5. **Limits** — if `limit` is set, counts current resources and checks against plan limits.

**For handlers that need additional org checks** (e.g. cross-referencing org membership after the middleware):

```ts
import { requireOrgPermissionAccess } from "../../modules/organizations/shared";

.handler(async ({ input, context }) => {
  // Double-check org permission with full org fetch
  const org = await requireOrgPermissionAccess(
    input.organizationId,
    context.user.id,
    PERMISSIONS.ORGANIZATION.VIEW,
    context.headers,
  );
  // org is guaranteed to exist + user is a member + has the permission
});
```

### 3. Client Components (UI Gating)

**Pattern:** Instantiate the AccessControl at module level, check permissions inline, conditionally render UI elements.

#### System permissions (admin vs user):

```tsx
"use client";
import { authClient } from "@fuutu/auth/client";
import { type UserWithRole, userHasPermission } from "@fuutu/auth/types";
import { PERMISSIONS, SYSTEM_POLICY, SystemAccessControl } from "@fuutu/rbac";

const ac = new SystemAccessControl(SYSTEM_POLICY);

export function MyComponent() {
  const { data: session } = authClient.useSession();
  const user = session?.user as UserWithRole | undefined;
  const isAdmin = user ? userHasPermission(ac, user, PERMISSIONS.VIEW_ADMIN) : false;

  return (
    <nav>
      {isAdmin && <Link href="/admin">Admin Panel</Link>}
    </nav>
  );
}
```

#### Org permissions (member vs admin vs owner):

```tsx
"use client";
import { authClient } from "@fuutu/auth/client";
import {
  hasOrgPermission,
  ORG_POLICY,
  OrgAccessControl,
  PERMISSIONS,
  toOrgRole,
} from "@fuutu/rbac";

const ac = new OrgAccessControl(ORG_POLICY);

export function OrgSettings({ slug }: { slug: string }) {
  const { data: session } = authClient.useSession();
  const [org, setOrg] = useState<FullOrg | null>(null);

  const currentUserId = session?.user?.id;
  const currentUserRole = org?.members?.find(
    (m) => m.userId === currentUserId,
  )?.role;
  const canEdit = currentUserRole
    ? hasOrgPermission(ac, toOrgRole(currentUserRole), PERMISSIONS.ORGANIZATION.UPDATE)
    : false;

  // Hide the Save button when the user can't update the org
  return (
    <form>
      <Input value={name} onChange={...} disabled={!canEdit} />
      {canEdit && <Button type="submit">Save</Button>}
    </form>
  );
}
```

**Key rules for UI gating:**
- **Always gate the action UI** (buttons, forms) — not just the page. A member can see the settings page but shouldn't see the "Save" button.
- **Disable inputs** when the user can't edit — don't just hide the button, make the whole form read-only.
- **Backend is the source of truth** — UI gating is for UX, not security. The oRPC procedure must also enforce the permission. If a user bypasses the UI (e.g. via `fetch()`), the backend returns `403 FORBIDDEN`.

### 4. Role Hierarchy Helpers

```ts
import { hasRoleAtLeast, toOrgRole } from "@fuutu/rbac";

// Check if a role meets a minimum threshold
if (hasRoleAtLeast(toOrgRole(member.role), "admin")) {
  // user is admin or owner
}
```

Used in handlers that need role-comparison logic (e.g. "can't demote an owner", "can't invite someone to a higher role than yourself").

---

## Enforcement Layers (Defense in Depth)

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: Proxy (proxy.ts)                                       │
│   Unauthenticated → 307 redirect to /auth/sign-in               │
│   Public routes: /api/auth, /api/webhooks, /api/docs, /auth/*   │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: Server Component (requireAuth / requireAdmin)          │
│   No session → redirect to sign-in                              │
│   Not admin → redirect to /dashboard?error=forbidden            │
├─────────────────────────────────────────────────────────────────┤
│ Layer 3: oRPC Middleware (authProcedure)                        │
│   No session → 401 UNAUTHORIZED                                 │
│   No org membership → 404 NOT_FOUND / 403 FORBIDDEN             │
│   No permission → 403 FORBIDDEN "Insufficient permissions"      │
│   Plan too low → 403 FORBIDDEN "This feature requires..."       │
│   Limit exceeded → 403 FORBIDDEN "Limit exceeded"               │
├─────────────────────────────────────────────────────────────────┤
│ Layer 4: UI Gating (Client Components)                          │
│   Hide/disable buttons based on permission checks               │
│   UX only — not a security boundary                             │
└─────────────────────────────────────────────────────────────────┘
```

**Security boundary = Layers 1-3.** Layer 4 (UI gating) is for user experience — it prevents users from clicking buttons that would fail, but it is NOT a security control. A determined user can always bypass the UI and call the API directly. The backend (Layer 3) is the real enforcement.

---

## File Reference

| File | Purpose |
|---|---|
| `packages/rbac/src/index.ts` | Core types, AccessControl classes, helper functions |
| `packages/rbac/src/permissions.ts` | Permission definitions (CRUD_RESOURCES, CUSTOM_PERMISSIONS, PERMISSIONS) |
| `packages/rbac/src/system-policy.ts` | SYSTEM_POLICY — what `user` and `admin` can do |
| `packages/rbac/src/org-policy.ts` | ORG_POLICY — what `member`, `admin`, `owner` can do |
| `packages/api/src/orpc/middleware/authorize.ts` | `authProcedure()` middleware — the core enforcement layer |
| `packages/api/src/orpc/procedures.ts` | `protectedProcedure`, `permissionProcedure`, `adminProcedure` |
| `packages/api/src/modules/organizations/shared.ts` | `requireOrgRole()`, `requireOrgPermissionAccess()`, `getOrgOrNull()` |
| `packages/auth/src/types.ts` | `UserWithRole`, `userHasPermission()`, `getUserRole()` |
| `apps/saas/src/lib/auth-server.ts` | `requireAuth()`, `requireAdmin()`, `requireOnboarded()` |
