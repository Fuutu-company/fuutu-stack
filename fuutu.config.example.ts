/**
 * Fuutu MCP integration — optional integration point.
 *
 * This file is **optional**. The Kit runs fine without it. When present,
 * it is consumed by the *separate* Fuutu MCP server (published in its own
 * repository) so an LLM agent (Claude Desktop, Cursor, Windsurf, …) can
 * discover this project, understand its layout, and call Fuutu-managed
 * tools against it.
 *
 * No active MCP runtime ships in this monorepo — this Kit only declares
 * the dock-point. To enable MCP integration:
 *
 *   1. Copy this file to `fuutu.config.ts` in the repo root.
 *   2. Fill in `projectId` (issued by Fuutu when you connect the project)
 *      and `mcpEndpoint` (defaults to
 *      `https://app.fuutustack.com/api/mcp/fuutu-stack/sse`).
 *   3. Provide your org-scoped API key via the `FUUTU_MCP_API_KEY`
 *      environment variable — preferred over `apiKey` so no key is
 *      committed to the repo.
 *   4. Point your MCP-aware editor at the Fuutu MCP server. See the
 *      "Fuutu MCP Integration" section in README.md.
 *
 * `kitVersion` needs no manual setup: the MCP handshake auto-reads
 * `KIT_VERSION` from `packages/config`. Set it only to pin a specific
 * kit version for docs/tool matching.
 */

export type FuutuMcpConfig = {
	/** Stable ID issued by Fuutu when you register the project. */
	projectId: string;
	/** Override the default Fuutu MCP endpoint (framework-namespaced). */
	mcpEndpoint?: string;
	/**
	 * Org-scoped MCP API key. Prefer the `FUUTU_MCP_API_KEY` environment
	 * variable over committing a key to this file.
	 */
	apiKey?: string;
	/**
	 * Manual kit-version pin for the MCP version handshake. When omitted,
	 * the current `KIT_VERSION` from `packages/config` is sent instead.
	 */
	kitVersion?: string;
	/**
	 * Framework namespace for docs/MCP routing.
	 * Default: "fuutu-stack".
	 */
	framework?: string;
	/**
	 * Per-project flags the MCP server reads to decide which tools to
	 * expose. Unknown keys are ignored — forward-compatible by design.
	 */
	flags?: Record<string, boolean>;
};

const config: FuutuMcpConfig = {
	projectId: "",
	mcpEndpoint: "https://app.fuutustack.com/api/mcp/fuutu-stack/sse",
	// apiKey: "", // prefer the FUUTU_MCP_API_KEY environment variable
	// kitVersion: "", // manual pin — auto-read from KIT_VERSION when omitted
	framework: "fuutu-stack",
	flags: {},
};

export default config;
