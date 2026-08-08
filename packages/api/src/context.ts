import { auth } from "@fuutu/auth";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		session,
		headers: context.req.raw.headers as Headers,
	};
}

export type Context = {
	session: Awaited<ReturnType<typeof auth.api.getSession>>;
	headers: Headers;
};
