import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callCkanAction } from "../ckan-client.js";

const PACKAGE_SEARCH_TOOL_NAME = "package_search";

interface PackageSearchResult {
	readonly count: number;
	readonly results: readonly Record<string, unknown>[];
}

/**
 * Registers the `package_search` tool, which wraps the CKAN `package_search`
 * Action API to search/filter datasets on the Regione Calabria open data
 * portal, rather than paging through the full (1000+ entry) package_list.
 *
 * @see https://docs.ckan.org/en/latest/api/index.html#ckan.logic.action.get.package_search
 */
export function registerPackageSearchTool(server: McpServer): void {
	server.registerTool(
		PACKAGE_SEARCH_TOOL_NAME,
		{
			title: "Search open data packages",
			description:
				"Searches/filters the datasets (packages) published on the Regione Calabria " +
				"open data portal using a free-text query, returning matching datasets with " +
				"their full metadata. Preferred over package_list for finding relevant datasets.",
			inputSchema: {
				q: z
					.string()
					.min(1)
					.optional()
					.describe(
						'Free-text search query (Solr syntax), e.g. "acque" or "tags:economia". Defaults to matching all datasets.',
					),
				rows: z
					.number()
					.int()
					.positive()
					.max(1000)
					.optional()
					.describe(
						"Maximum number of matching datasets to return (optional, CKAN default: 10).",
					),
				start: z
					.number()
					.int()
					.nonnegative()
					.optional()
					.describe(
						"Offset in the full result set where the returned datasets should begin (optional).",
					),
				sort: z
					.string()
					.min(1)
					.optional()
					.describe(
						'Sorting of results, e.g. "metadata_modified desc" (optional, CKAN default: relevance).',
					),
			},
			outputSchema: {
				count: z
					.number()
					.describe(
						"Total number of datasets matching the query (independent of rows/start).",
					),
				results: z
					.array(z.record(z.string(), z.unknown()))
					.describe("The matching datasets, with their full CKAN metadata."),
			},
		},
		async ({ q, rows, start, sort }) => {
			const { count, results } = await callCkanAction<PackageSearchResult>(
				"package_search",
				{ q, rows, start, sort },
			);
			const structuredContent = { count, results };

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
