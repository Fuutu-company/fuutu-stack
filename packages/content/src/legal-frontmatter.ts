import { z } from "zod";
import { isoDate } from "./iso-date";

export const legalDocumentFrontmatterSchema = z.object({
	title: z.string().min(1),
	updatedAt: isoDate,
});
