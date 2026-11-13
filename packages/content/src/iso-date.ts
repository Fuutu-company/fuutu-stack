import { z } from "zod";

/** ISO date string that `new Date()` can parse — rejects NaN-sorting dates. */
export const isoDate = z
	.string()
	.refine((v) => !Number.isNaN(new Date(v).getTime()), {
		message: "must be a parseable ISO date",
	});
