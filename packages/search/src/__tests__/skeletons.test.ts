import { meilisearchProvider } from "../providers/meilisearch";
import { noopProvider } from "../providers/noop";
import { typesenseProvider } from "../providers/typesense";
import { testSearchProviderContract } from "./provider-contract";

testSearchProviderContract("meilisearch", () => meilisearchProvider, {
	searchBehavior: "throws",
	indexBehavior: "throws",
	throwsContains: "not implemented",
});

testSearchProviderContract("typesense", () => typesenseProvider, {
	searchBehavior: "throws",
	indexBehavior: "throws",
	throwsContains: "not implemented",
});

testSearchProviderContract("noop", () => noopProvider, {
	searchBehavior: "resolves",
	indexBehavior: "resolves",
	returnsEmpty: true,
});
