/**
 * Structural mirror of `UserWithRole` from `@fuutu/auth/types`.
 * Defined locally to avoid a dependency cycle (`@fuutu/auth` → `@fuutu/logs`
 * → `@fuutu/test-utils` → `@fuutu/auth`). Structural typing keeps this
 * assignment-compatible with the real type.
 */
interface SessionUser {
	id: string;
	email: string;
	name: string;
	image?: string | null;
	emailVerified?: boolean | null;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
	role?: string | null;
	banned?: boolean | null;
	banReason?: string | null;
	banExpires?: Date | string | null;
}

export function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
	return {
		id: "user-1",
		email: "test@fuutu.local",
		name: "Test User",
		image: null,
		emailVerified: true,
		createdAt: new Date("2024-01-01"),
		role: "user",
		...overrides,
	};
}

export function makeSession<T>(user: SessionUser | null): T {
	// Double-cast (`as unknown as T`) is safe here: this is a test utility that
	// builds a minimal session shape compatible with any consumer's session type.
	// Importing the real session type from @fuutu/api would create a circular
	// dependency (@fuutu/api → @fuutu/test-utils for testing helpers). Test code
	// is not production code — the structural shape is guaranteed by SessionUser.
	return user
		? ({ session: { user }, headers: new Headers() } as unknown as T)
		: ({ session: null, headers: new Headers() } as unknown as T);
}
