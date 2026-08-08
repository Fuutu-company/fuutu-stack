import common from "./common/index";
import docs from "./docs/index";
import marketing from "./marketing/index";
import saas from "./saas/index";

export default {
	...common,
	...marketing,
	...saas,
	...docs,
} as const;
