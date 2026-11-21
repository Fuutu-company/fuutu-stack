import common from "./common/index";
import desktop from "./desktop/index";
import docs from "./docs/index";
import marketing from "./marketing/index";
import saas from "./saas/index";

export default {
	...common,
	...marketing,
	...saas,
	// Docs namespaces (`nav`, `home`, …) collide with marketing's — keep
	// them nested under `docs` instead of shallow-spreading.
	docs,
	// Desktop namespaces are already nested under `desktop`.
	...desktop,
} as const;
