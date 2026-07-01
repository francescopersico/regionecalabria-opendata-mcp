import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callCkanAction } from "../ckan-client.js";

const DATASTORE_SEARCH_TOOL_NAME = "datastore_search";

/**
 * Maximum number of rows this tool will ever request from CKAN in a single
 * call, regardless of the `limit` the caller asks for. Mirrors the cap
 * already used on `package_search`'s `rows` parameter; well below CKAN's own
 * `ckan.datastore.search.rows_max` (32000 by default) to keep responses a
 * reasonable size for an LLM to consume.
 */
const MAX_ROWS = 1000;

interface DatastoreSearchResult {
	readonly total?: number;
	readonly fields: readonly Record<string, unknown>[];
	readonly records: readonly Record<string, unknown>[];
}

/**
 * Registers the `datastore_search` tool, which wraps the CKAN DataStore's
 * `datastore_search` Action API to query the actual tabular data (rows)
 * stored inside a dataset's resource, rather than only its metadata.
 *
 * Only resources with `datastore_active: true` (as seen in `package_show`'s
 * `resources` array) can be queried this way; use `package_show` first to
 * find a suitable `resource_id`.
 *
 * @see https://docs.ckan.org/en/latest/maintaining/datastore.html#ckanext.datastore.logic.action.datastore_search
 */
export function registerDatastoreSearchTool(server: McpServer): void {
	server.registerTool(
		DATASTORE_SEARCH_TOOL_NAME,
		{
			title: "Search data rows inside a dataset resource",
			description:
				"Searches/filters the actual data rows stored inside a DataStore-enabled resource " +
				"of a Regione Calabria open data dataset (not just its metadata). Requires the " +
				"resource_id of a resource with datastore_active: true; get one by calling " +
				"package_show on a dataset and inspecting its resources array.",
			inputSchema: {
				resourceId: z
					.string()
					.min(1)
					.describe(
						"Id (or alias) of the DataStore-enabled resource to query, from package_show's resources[].id.",
					),
				q: z
					.string()
					.min(1)
					.optional()
					.describe(
						"Full-text query matched against all fields of each row (optional).",
					),
				filters: z
					.record(z.string(), z.unknown())
					.optional()
					.describe(
						'Exact-match filters as a field name -> value map, e.g. {"comune": "Catanzaro"} (optional).',
					),
				fields: z
					.array(z.string().min(1))
					.optional()
					.describe(
						"Subset of field/column names to return per row (optional, default: all fields).",
					),
				sort: z
					.string()
					.min(1)
					.optional()
					.describe(
						'Sorting of results, e.g. "anno_iscrizione desc" (optional, CKAN default: unsorted).',
					),
				limit: z
					.number()
					.int()
					.positive()
					.max(MAX_ROWS)
					.optional()
					.describe(
						`Maximum number of rows to return (optional, CKAN default: 100, capped here at ${MAX_ROWS}).`,
					),
				offset: z
					.number()
					.int()
					.nonnegative()
					.optional()
					.describe(
						"Number of rows to skip before starting to return results; used together with limit (optional).",
					),
			},
			outputSchema: {
				total: z
					.number()
					.optional()
					.describe(
						"Total number of rows matching the query, independent of limit/offset.",
					),
				fields: z
					.array(z.record(z.string(), z.unknown()))
					.describe("Column definitions (id and type) for the returned rows."),
				records: z
					.array(z.record(z.string(), z.unknown()))
					.describe("The matching rows, as field name -> value objects."),
			},
		},
		async ({ resourceId, q, filters, fields, sort, limit, offset }) => {
			const {
				total,
				fields: resultFields,
				records,
			} = await callCkanAction<DatastoreSearchResult>("datastore_search", {
				resource_id: resourceId,
				q,
				filters: filters ? JSON.stringify(filters) : undefined,
				fields: fields?.join(","),
				sort,
				limit,
				offset,
			});
			const structuredContent = { total, fields: resultFields, records };

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
