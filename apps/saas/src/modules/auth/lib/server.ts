import { auth } from "@fuutu/auth";
import { headers } from "next/headers";
import { cache } from "react";

export const getSession = cache(async () => {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});
		return session;
	} catch {
		return null;
	}
});

export const requireAuth = cache(async () => {
	const session = await getSession();
	if (!session?.user) {
		throw new Error("Unauthorized");
	}
	return session;
});
