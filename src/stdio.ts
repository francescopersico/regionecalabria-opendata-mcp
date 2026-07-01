#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

/**
 * stdio transport entrypoint, for local/process-spawned MCP clients
 * (e.g. Claude Desktop, VS Code). Never write to stdout directly here:
 * it is reserved for JSON-RPC messages. Use console.error for logs.
 */
async function main(): Promise<void> {
	const server = createServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("regionecalabria-opendata-mcp running on stdio");
}

main().catch((error: unknown) => {
	console.error("Fatal error starting MCP server (stdio transport):", error);
	process.exit(1);
});
