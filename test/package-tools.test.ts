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

describe("package tools", () => {
	let fetchMock: MockInstance<typeof fetch>;

	beforeEach(() => {
		fetchMock = vi.fn() as unknown as MockInstance<typeof fetch>;
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("registers get_version, package_list, package_show and package_search", async () => {
		const client = await connectClient();

		const { tools } = await client.listTools();

		expect(tools.map((tool) => tool.name)).toEqual(
			expect.arrayContaining([
				"get_version",
				"package_list",
				"package_show",
				"package_search",
			]),
		);
	});

	describe("package_list", () => {
		it("returns dataset names from CKAN's package_list action", async () => {
			fetchMock.mockResolvedValue(
				jsonResponse({
					success: true,
					result: ["acque-minerali", "aree-protette"],
				}),
			);
			const client = await connectClient();

			const result = await client.callTool({
				name: "package_list",
				arguments: { limit: 2 },
			});

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toEqual({
				names: ["acque-minerali", "aree-protette"],
			});
			const [requestedUrl] = fetchMock.mock.calls[0] as [URL];
			expect(requestedUrl.toString()).toContain("package_list?limit=2");
		});

		it("surfaces CKAN errors as tool errors", async () => {
			fetchMock.mockResolvedValue(
				jsonResponse({ success: false, error: { message: "boom" } }, 500),
			);
			const client = await connectClient();

			const result = await client.callTool({
				name: "package_list",
				arguments: {},
			});

			expect(result.isError).toBe(true);
		});
	});

	describe("package_show", () => {
		it("returns the dataset as-is from CKAN's package_show action", async () => {
			const dataset = {
				id: "abc-123",
				name: "acque-minerali",
				title: "Acque Minerali",
			};
			fetchMock.mockResolvedValue(
				jsonResponse({ success: true, result: dataset }),
			);
			const client = await connectClient();

			const result = await client.callTool({
				name: "package_show",
				arguments: { id: "acque-minerali" },
			});

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toEqual({ dataset });
			const [requestedUrl] = fetchMock.mock.calls[0] as [URL];
			expect(requestedUrl.toString()).toContain(
				"package_show?id=acque-minerali",
			);
		});
	});

	describe("package_search", () => {
		it("returns count and results from CKAN's package_search action", async () => {
			const searchResult = {
				count: 1,
				results: [{ id: "abc-123", name: "acque-minerali" }],
			};
			fetchMock.mockResolvedValue(
				jsonResponse({ success: true, result: searchResult }),
			);
			const client = await connectClient();

			const result = await client.callTool({
				name: "package_search",
				arguments: { q: "acque", rows: 5 },
			});

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toEqual(searchResult);
			const [requestedUrl] = fetchMock.mock.calls[0] as [URL];
			expect(requestedUrl.toString()).toContain(
				"package_search?q=acque&rows=5",
			);
		});
	});
});
