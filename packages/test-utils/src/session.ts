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
	// Mirrors Better Auth's getSession() result: { user, session } — the
	// inner `session` carries token/expiry that procedures may read
	// (`context.session.session.token`). Omitting it would mask real
	// session-field accesses behind the cast.
	return user
		? ({
				session: {
					user,
					session: {
						id: "session-1",
						token: "test-token",
						userId: user.id,
						expiresAt: new Date(Date.now() + 3_600_000),
						createdAt: new Date("2024-01-01"),
						updatedAt: new Date("2024-01-01"),
					},
				},
				headers: new Headers(),
			} as unknown as T)
		: ({ session: null, headers: new Headers() } as unknown as T);
}
