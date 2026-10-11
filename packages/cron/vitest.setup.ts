import { vi } from "vitest";

// Minimal env vars so @fuutu/env/saas validation passes in tests.
process.env.DATABASE_URL ??= "postgresql://fake:fake@localhost:5432/fake";
process.env.BETTER_AUTH_SECRET ??=
	"test-secret-for-vitest-at-least-32-chars-long";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.NODE_ENV ??= "test";

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));
