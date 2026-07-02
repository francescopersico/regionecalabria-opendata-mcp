import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPackageMetadata } from "./package-metadata.js";
import { registerDatastoreSearchTool } from "./tools/datastore-search-tool.js";
import { registerGroupListTool } from "./tools/group-list-tool.js";
import { registerGroupShowTool } from "./tools/group-show-tool.js";
import { registerPackageListTool } from "./tools/package-list-tool.js";
import { registerPackageSearchTool } from "./tools/package-search-tool.js";
import { registerPackageShowTool } from "./tools/package-show-tool.js";
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
	registerPackageListTool(server);
	registerPackageShowTool(server);
	registerPackageSearchTool(server);
	registerDatastoreSearchTool(server);
	registerGroupListTool(server);
	registerGroupShowTool(server);

	return server;
}
