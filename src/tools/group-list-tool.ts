import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callCkanAction } from "../ckan-client.js";

const GROUP_LIST_TOOL_NAME = "group_list";

interface CkanGroup {
	readonly name: string;
	readonly title?: string;
	readonly description?: string;
	readonly package_count?: number;
}

/**
 * Registers the `group_list` tool, which wraps the CKAN `group_list`
 * Action API to return the thematic categories ("temi") used to classify
 * datasets on the Regione Calabria open data portal, e.g. Agricoltura,
 * Ambiente, Economia. Each theme includes how many datasets it currently
 * contains, to help decide which ones are worth exploring further via
 * `package_search` (e.g. `q: "groups:agricoltura"`).
 *
 * @see https://docs.ckan.org/en/latest/api/index.html#ckan.logic.action.get.group_list
 */
export function registerGroupListTool(server: McpServer): void {
	server.registerTool(
		GROUP_LIST_TOOL_NAME,
		{
			title: "List dataset themes",
			description:
				"Lists the thematic categories ('temi', CKAN groups) used to classify datasets " +
				"on the Regione Calabria open data portal (e.g. Agricoltura, Ambiente, Economia), " +
				"each with its current dataset count. Use the group's name with package_search " +
				'(e.g. q: "groups:agricoltura") to list its datasets.',
			inputSchema: {},
			outputSchema: {
				groups: z
					.array(
						z.object({
							name: z
								.string()
								.describe(
									"The group's short name/id, usable in package_search as groups:<name>.",
								),
							title: z.string().describe("The group's human-readable title."),
							description: z
								.string()
								.describe("A short description of the theme."),
							packageCount: z
								.number()
								.describe("Number of datasets currently in this theme."),
						}),
					)
					.describe("The portal's dataset themes."),
			},
		},
		async () => {
			const result = await callCkanAction<CkanGroup[]>("group_list", {
				all_fields: "true",
			});
			const groups = result.map((group) => ({
				name: group.name,
				title: group.title ?? group.name,
				description: group.description ?? "",
				packageCount: group.package_count ?? 0,
			}));
			const structuredContent = { groups };

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
