import { API_KEY_HEADER } from "./context";

/**
 * Request headers a credentialed cross-origin caller (CORS_ORIGIN) may send.
 * Must cover every header the API authenticates with — session cookies need
 * no header, API keys arrive via `Authorization: Bearer` or `x-api-key`.
 */
export const CORS_ALLOW_HEADERS = [
	"Content-Type",
	"Authorization",
	API_KEY_HEADER,
];
