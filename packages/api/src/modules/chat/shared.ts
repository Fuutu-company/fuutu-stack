import { z } from "zod";

export const conversationIdSchema = z.object({
	conversationId: z.string().min(1),
});
