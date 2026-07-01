import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callCkanAction } from "../ckan-client.js";

const PACKAGE_LIST_TOOL_NAME = "package_list";

/**
 * Registers the `package_list` tool, which wraps the CKAN `package_list`
 * Action API to return the names of the datasets published on the
 * Regione Calabria open data portal.
 *
 * @see https://docs.ckan.org/en/latest/api/index.html#ckan.logic.action.get.package_list
 */
export function registerPackageListTool(server: McpServer): void {
	server.registerTool(
		PACKAGE_LIST_TOOL_NAME,
		{
			title: "List open data packages",
			description:
				"Returns the names (identifiers) of the datasets (packages) published on the " +
				"Regione Calabria open data portal. Dataset names can be passed to " +
				"package_show to get full details. Supports optional paging.",
			inputSchema: {
				limit: z
					.number()
					.int()
					.positive()
					.optional()
					.describe(
						"Maximum number of dataset names to return per page (optional).",
					),
				offset: z
					.number()
					.int()
					.nonnegative()
					.optional()
					.describe(
						"Number of dataset names to skip before starting to return results; used together with limit (optional).",
					),
			},
			outputSchema: {
				names: z
					.array(z.string())
					.describe("Names (identifiers) of the datasets returned."),
			},
		},
		async ({ limit, offset }) => {
			const names = await callCkanAction<string[]>("package_list", {
				limit,
				offset,
			});
			const structuredContent = { names };

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
