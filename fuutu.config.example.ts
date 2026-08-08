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
 *      and `mcpEndpoint` (defaults to `https://stackapp.fuutu.com/api/mcp/sse`).
 *   3. Point your MCP-aware editor at the Fuutu MCP server. See the
 *      "Fuutu MCP Integration" section in README.md.
 */

export type FuutuMcpConfig = {
	/** Stable ID issued by Fuutu when you register the project. */
	projectId: string;
	/** Override the default Fuutu MCP endpoint. */
	mcpEndpoint?: string;
	/**
	 * Per-project flags the MCP server reads to decide which tools to
	 * expose. Unknown keys are ignored — forward-compatible by design.
	 */
	flags?: Record<string, boolean>;
};

const config: FuutuMcpConfig = {
	projectId: "",
	mcpEndpoint: "https://stackapp.fuutu.com/api/mcp/sse",
	flags: {},
};

export default config;
