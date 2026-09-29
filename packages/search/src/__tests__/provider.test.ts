import { describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	SEARCH_PROVIDER: undefined as
		| "postgres"
		| "meilisearch"
		| "typesense"
		| "noop"
		| undefined,
}));

vi.mock("@fuutu/env/saas", () => ({ env: envMock }));

vi.mock("@fuutu/db", () => ({
	searchNotifications: vi.fn(),
	searchAuditLogs: vi.fn(),
}));

import { resolveSearchProvider } from "../provider";
import { meilisearchProvider } from "../providers/meilisearch";
import { noopProvider } from "../providers/noop";
import { postgresProvider } from "../providers/postgres";
import { typesenseProvider } from "../providers/typesense";

describe("resolveSearchProvider", () => {
	it("falls back to searchConfig.provider when SEARCH_PROVIDER is unset", () => {
		envMock.SEARCH_PROVIDER = undefined;
		expect(resolveSearchProvider()).toBe(postgresProvider);
	});

	it("honors the SEARCH_PROVIDER env override", () => {
		envMock.SEARCH_PROVIDER = "meilisearch";
		expect(resolveSearchProvider()).toBe(meilisearchProvider);
		envMock.SEARCH_PROVIDER = "typesense";
		expect(resolveSearchProvider()).toBe(typesenseProvider);
		envMock.SEARCH_PROVIDER = "noop";
		expect(resolveSearchProvider()).toBe(noopProvider);
		envMock.SEARCH_PROVIDER = "postgres";
		expect(resolveSearchProvider()).toBe(postgresProvider);
	});
});
