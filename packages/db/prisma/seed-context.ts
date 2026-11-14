import type { db } from "./client";

/**
 * What the dev seed (`seed.ts`) hands the app seed hook (`app-seed.ts`)
 * once the kit demo data exists.
 */
export interface AppSeedContext {
	/** The Prisma client the kit seed writes with. */
	db: typeof db;
	/** Seeded users (`admin@fuutu.local`, `member@fuutu.local`). */
	users: { admin: { id: string }; member: { id: string } };
	/** Seeded organizations (slug `acme`, both users are members). */
	orgs: { acme: { id: string } };
	/** Seed start time in ms — base for deterministic `createdAt` values. */
	now: number;
}
