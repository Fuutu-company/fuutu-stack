import app from "./app.json";
import common from "./common.json";
import consent from "./consent.json";
import cron from "./cron.json";
import payments from "./payments.json";

export default { ...app, ...common, ...consent, ...cron, ...payments };
