import { env } from "@fuutu/env/saas";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client";

export type { Prisma } from "./generated/client";

const createPrismaClient = () => {
	const adapter = new PrismaPg({
		connectionString: env.DATABASE_URL,
	});

	return new PrismaClient({
		adapter,
	});
};

const globalForPrisma = globalThis as unknown as {
	prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
	globalForPrisma.prisma = db;
}
