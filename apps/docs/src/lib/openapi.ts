import { createOpenAPI } from "fumadocs-openapi/server";

export const openapi = createOpenAPI({
	input: ["./content/openapi/example.json"],
});
