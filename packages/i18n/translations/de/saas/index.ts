import admin from "./admin.json";
import apiKeys from "./api-keys.json";
import auth from "./auth.json";
import chat from "./chat.json";
import credits from "./credits.json";
import crm from "./crm.json";
import dashboard from "./dashboard.json";
import invoices from "./invoices.json";
import navigation from "./navigation.json";
import notifications from "./notifications.json";
import onboarding from "./onboarding.json";
import organizations from "./organizations.json";
import settings from "./settings.json";
import webhooks from "./webhooks.json";

export default {
	...admin,
	...apiKeys,
	...auth,
	...chat,
	...credits,
	...crm,
	...dashboard,
	...invoices,
	...navigation,
	...notifications,
	...onboarding,
	...organizations,
	...settings,
	...webhooks,
};
