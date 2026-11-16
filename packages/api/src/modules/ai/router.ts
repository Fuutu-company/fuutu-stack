import { featureRouter } from "../../orpc/middleware/require-feature";
import { chat } from "./procedures/chat";

/** Off with `config.features.aiChat` (NOT_FOUND). */
export const aiRouter = featureRouter("aiChat", {
	chat,
});
