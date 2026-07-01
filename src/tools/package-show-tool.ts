import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callCkanAction } from "../ckan-client.js";

const PACKAGE_SHOW_TOOL_NAME = "package_show";

/**
 * Registers the `package_show` tool, which wraps the CKAN `package_show`
 * Action API to return the full metadata (and resources) of a single
 * dataset from the Regione Calabria open data portal.
 *
 * The dataset is returned as-is (raw passthrough): this CKAN instance uses
 * the DCAT-AP_IT metadata profile, whose fields vary between datasets and
 * sometimes contain JSON-encoded strings (e.g. `theme`, `creator`), so no
 * strict schema is enforced on its shape.
 *
 * @see https://docs.ckan.org/en/latest/api/index.html#ckan.logic.action.get.package_show
 */
export function registerPackageShowTool(server: McpServer): void {
	server.registerTool(
		PACKAGE_SHOW_TOOL_NAME,
		{
			title: "Show open data package details",
			description:
				"Returns the full metadata and resources (files/APIs) of a single dataset " +
				"(package) from the Regione Calabria open data portal, given its id or name. " +
				"Use package_list or package_search to discover dataset ids/names first.",
			inputSchema: {
				id: z
					.string()
					.min(1)
					.describe("The id or name of the dataset to show."),
			},
			outputSchema: {
				dataset: z
					.record(z.string(), z.unknown())
					.describe(
						"The dataset's full metadata as returned by CKAN, including its resources.",
					),
			},
		},
		async ({ id }) => {
			const dataset = await callCkanAction<Record<string, unknown>>(
				"package_show",
				{ id },
			);
			const structuredContent = { dataset };

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
