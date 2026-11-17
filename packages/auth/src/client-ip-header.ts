/**
 * Client IP for Better Auth (rate limits, `session.ipAddress`).
 *
 * Better Auth would read `X-Forwarded-For` as sent by the client, so its
 * limits on sign-in, sign-up and password reset could be dodged with a
 * new fake IP per request. Instead it reads only `CLIENT_IP_HEADER`, which
 * the API's `/auth/**` handler sets from the kit's `getClientIp()`
 * (`TRUST_PROXY_HEADERS`) after removing any copy the client sent. With
 * no trusted IP the header is absent and Better Auth falls back to one
 * shared bucket per path — the same behavior as the kit's own limiter.
 */

export const CLIENT_IP_HEADER = "x-fuutu-client-ip";

/** Better Auth `advanced.ipAddress`. */
export const authIpAddressOptions = {
	ipAddressHeaders: [CLIENT_IP_HEADER],
};

/**
 * `request` with `CLIENT_IP_HEADER` set to `clientIp` (removed when null).
 *
 * Built from the request's parts, not `new Request(request, init)`: under
 * Next.js the incoming request is a wrapper whose private state the
 * constructor cannot read (`TypeError: Cannot read private member #state`).
 */
export function withClientIp(
	request: Request,
	clientIp: string | null,
): Request {
	const headers = new Headers(request.headers);
	headers.delete(CLIENT_IP_HEADER);
	if (clientIp) headers.set(CLIENT_IP_HEADER, clientIp);
	const hasBody = request.method !== "GET" && request.method !== "HEAD";
	const init: RequestInit & { duplex?: "half" } = {
		method: request.method,
		headers,
		signal: request.signal,
		...(hasBody ? { body: request.body, duplex: "half" } : {}),
	};
	return new Request(request.url, init);
}
