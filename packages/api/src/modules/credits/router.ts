import { featureRouter } from "../../orpc/middleware/require-feature";
import { getBalance } from "./procedures/balance";
import { getHistory } from "./procedures/history";
import { getPackages } from "./procedures/packages";

/** Off when credits are disabled (`config.features.credits`): NOT_FOUND. */
export const creditsRouter = featureRouter("credits", {
	balance: getBalance,
	history: getHistory,
	packages: getPackages,
});
