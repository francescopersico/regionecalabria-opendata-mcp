import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPackageMetadata } from "./package-metadata.js";
import { registerVersionTool } from "./tools/version-tool.js";

/**
 * Creates and configures a new MCP server instance, shared by every
 * transport entrypoint (stdio, Streamable HTTP, ...).
 *
 * A new instance must be created per connection/session; `McpServer`
 * instances are not meant to be reused across transports.
 */
export function createServer(): McpServer {
	const { name, version } = getPackageMetadata();

	const server = new McpServer({ name, version });

	registerVersionTool(server);

	return server;
}
