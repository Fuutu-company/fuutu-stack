import type { SearchConfig } from "./types";

export const searchConfig: SearchConfig = {
	provider: "postgres",
	defaultLimit: 20,
	maxLimit: 50,
	maxOffset: 10_000,
};
