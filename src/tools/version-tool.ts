import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPackageMetadata } from "../package-metadata.js";

const VERSION_TOOL_NAME = "get_version";

/**
 * Registers the `get_version` tool, which reports this MCP server's own
 * name and version as declared in its package.json. Takes no input.
 */
export function registerVersionTool(server: McpServer): void {
	server.registerTool(
		VERSION_TOOL_NAME,
		{
			title: "Get server version",
			description:
				"Returns this MCP server's name and version, as declared in its package.json.",
			outputSchema: {
				name: z.string().describe("The package name of this MCP server."),
				version: z
					.string()
					.describe("The semantic version of this MCP server."),
			},
		},
		async () => {
			const { name, version } = getPackageMetadata();
			const structuredContent = { name, version };

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(structuredContent),
					},
				],
				structuredContent,
			};
		},
	);
}
