import { z } from "zod";
import { isoDate } from "./iso-date";

export const postFrontmatterSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	publishedAt: isoDate,
	draft: z.boolean().optional(),
	authors: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
});
