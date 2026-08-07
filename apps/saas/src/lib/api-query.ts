import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { api } from "./api-client";

export const apiQuery = createTanstackQueryUtils(api);
