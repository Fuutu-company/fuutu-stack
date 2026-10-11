import { getBalance } from "./procedures/balance";
import { getHistory } from "./procedures/history";
import { getPackages } from "./procedures/packages";

export const creditsRouter = {
	balance: getBalance,
	history: getHistory,
	packages: getPackages,
};
