import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callCkanAction } from "../ckan-client.js";

const GROUP_SHOW_TOOL_NAME = "group_show";

interface CkanGroupPackage {
	readonly id: string;
	readonly name: string;
	readonly title?: string;
}

interface CkanGroupShowResult {
	readonly name: string;
	readonly title?: string;
	readonly description?: string;
	readonly package_count?: number;
	readonly packages?: readonly CkanGroupPackage[];
}

/**
 * Registers the `group_show` tool, which wraps the CKAN `group_show`
 * Action API to return the details of one dataset theme ("tema") from the
 * Regione Calabria open data portal, along with the id/name/title of the
 * datasets it contains.
 *
 * Unlike `package_show`, this tool does not pass through CKAN's raw
 * response: `group_show` with `include_datasets: true` would otherwise
 * return a full, deeply nested dataset dictionary per package (redundant
 * with `package_show`) plus the group's members/users. To keep the
 * response small and avoid exposing user/account data, this tool asks
 * CKAN to omit users, followers, extras and sub-groups, and reshapes each
 * dataset down to `{ id, name, title }` (use `package_show` for full
 * dataset details).
 *
 * @see https://docs.ckan.org/en/latest/api/index.html#ckan.logic.action.get.group_show
 */
export function registerGroupShowTool(server: McpServer): void {
	server.registerTool(
		GROUP_SHOW_TOOL_NAME,
		{
			title: "Show dataset theme details",
			description:
				"Returns the details of a single dataset theme ('tema', CKAN group) from the " +
				"Regione Calabria open data portal, given its id or name, including a lightweight " +
				"list of the datasets in it (id, name, title). Use group_list to discover theme " +
				"names, and package_show for full dataset details.",
			inputSchema: {
				id: z.string().min(1).describe("The id or name of the theme to show."),
			},
			outputSchema: {
				name: z.string().describe("The theme's short name/id."),
				title: z.string().describe("The theme's human-readable title."),
				description: z.string().describe("A short description of the theme."),
				packageCount: z
					.number()
					.describe("Number of datasets currently in this theme."),
				datasets: z
					.array(
						z.object({
							id: z.string(),
							name: z.string(),
							title: z.string(),
						}),
					)
					.describe(
						"Datasets in this theme; pass their name/id to package_show for full details.",
					),
			},
		},
		async ({ id }) => {
			const result = await callCkanAction<CkanGroupShowResult>("group_show", {
				id,
				include_datasets: "true",
				include_users: "false",
				include_followers: "false",
				include_extras: "false",
				include_groups: "false",
			});

			const structuredContent = {
				name: result.name,
				title: result.title ?? result.name,
				description: result.description ?? "",
				packageCount: result.package_count ?? 0,
				datasets: (result.packages ?? []).map((pkg) => ({
					id: pkg.id,
					name: pkg.name,
					title: pkg.title ?? pkg.name,
				})),
			};

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
