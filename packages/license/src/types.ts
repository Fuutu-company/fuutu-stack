/**
 * Modes the Kit can be running in, derived from the configured license key.
 *
 *   - `"oss"`         — no license key configured. Free use under the
 *                       Eligibility Thresholds in LICENSE.md §3.
 *   - `"mcp"`         — a paid **MCP Subscription** key. Grants access to
 *                       both Fuutu agent surfaces:
 *                         * MCP for editors at
 *                           `stackapp.fuutu.com/api/mcp/sse`,
 *                         * Better-Auth Agent-Auth for custom agents at
 *                           `stackapp.fuutu.com/.well-known/agent-configuration`.
 *                       Also grants the versioning API. Does **not** lift the
 *                       Eligibility Thresholds for the commercial-use
 *                       grant. See LICENSE.md §4a. Current price at
 *                       https://stack.fuutu.com/pricing.
 *   - `"enterprise"`  — a Fuutu Enterprise License key validated by the
 *                       Fuutu license endpoint. Lifts the Eligibility
 *                       Thresholds and includes MCP access. See
 *                       LICENSE.md §4. Current price at
 *                       https://stack.fuutu.com/pricing.
 */
export type LicenseMode = "oss" | "mcp" | "enterprise";

export type LicenseStatus = {
	/** Resolved mode — `"oss"` if no key is configured. */
	mode: LicenseMode;
	/** True when a configured key has been validated against the endpoint. */
	valid: boolean;
	/** ISO date the validator last ran (in-memory cache freshness). */
	checkedAt: string;
	/**
	 * One-way hash of the configured license key (or `"oss"` if none).
	 * Safe to send over the wire — never the raw key.
	 */
	licenseKeyHash: string;
	/**
	 * Human-readable reason — populated when `valid === false` so ops can
	 * see why the kit reverted to OSS mode (offline, 401, malformed, …).
	 */
	reason?: string;
};

export type CheckLicenseOptions = {
	/** Override the default endpoint (mostly for tests). */
	endpoint?: string;
	/** Override the configured key (mostly for tests). */
	licenseKey?: string;
	/** Force a re-check, bypassing the in-memory cache. */
	force?: boolean;
	/**
	 * Total budget for the network round-trip. Default 5 s — keeps the
	 * Kit's startup path snappy and matches the telemetry-ping budget.
	 */
	timeoutMs?: number;
};
