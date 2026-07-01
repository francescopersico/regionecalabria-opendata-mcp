import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import { createServer } from "../src/server.js";

async function connectClient(): Promise<Client> {
	const server = createServer();
	const client = new Client({ name: "test-client", version: "0.0.0" });

	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();

	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);

	return client;
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("datastore_search tool", () => {
	let fetchMock: MockInstance<typeof fetch>;

	beforeEach(() => {
		fetchMock = vi.fn() as unknown as MockInstance<typeof fetch>;
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("is exposed via tools/list", async () => {
		const client = await connectClient();

		const { tools } = await client.listTools();

		expect(tools.map((tool) => tool.name)).toContain("datastore_search");
	});

	it("returns fields/records/total from CKAN's datastore_search action", async () => {
		const searchResult = {
			total: 2,
			fields: [{ id: "comune", type: "text" }],
			records: [{ comune: "Catanzaro" }],
		};
		fetchMock.mockResolvedValue(
			jsonResponse({ success: true, result: searchResult }),
		);
		const client = await connectClient();

		const result = await client.callTool({
			name: "datastore_search",
			arguments: { resourceId: "abc-123", q: "Catanzaro", limit: 10 },
		});

		expect(result.isError).toBeFalsy();
		expect(result.structuredContent).toEqual(searchResult);
		const [requestedUrl] = fetchMock.mock.calls[0] as [URL];
		expect(requestedUrl.toString()).toContain("datastore_search?");
		expect(requestedUrl.toString()).toContain("resource_id=abc-123");
		expect(requestedUrl.toString()).toContain("q=Catanzaro");
		expect(requestedUrl.toString()).toContain("limit=10");
	});

	it("serializes filters as a JSON string and fields as a comma-separated list", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({
				success: true,
				result: { fields: [], records: [] },
			}),
		);
		const client = await connectClient();

		await client.callTool({
			name: "datastore_search",
			arguments: {
				resourceId: "abc-123",
				filters: { comune: "Catanzaro" },
				fields: ["comune", "provincia"],
			},
		});

		const [requestedUrl] = fetchMock.mock.calls[0] as [URL];
		expect(requestedUrl.searchParams.get("filters")).toBe(
			JSON.stringify({ comune: "Catanzaro" }),
		);
		expect(requestedUrl.searchParams.get("fields")).toBe("comune,provincia");
	});

	it("surfaces CKAN errors as tool errors", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(
				{ success: false, error: { message: "resource not found" } },
				404,
			),
		);
		const client = await connectClient();

		const result = await client.callTool({
			name: "datastore_search",
			arguments: { resourceId: "does-not-exist" },
		});

		expect(result.isError).toBe(true);
	});
});
