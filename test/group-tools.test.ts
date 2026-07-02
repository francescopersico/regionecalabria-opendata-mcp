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

describe("group tools", () => {
	let fetchMock: MockInstance<typeof fetch>;

	beforeEach(() => {
		fetchMock = vi.fn() as unknown as MockInstance<typeof fetch>;
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("registers group_list and group_show", async () => {
		const client = await connectClient();

		const { tools } = await client.listTools();

		expect(tools.map((tool) => tool.name)).toEqual(
			expect.arrayContaining(["group_list", "group_show"]),
		);
	});

	describe("group_list", () => {
		it("returns themes with their dataset counts from CKAN's group_list action", async () => {
			fetchMock.mockResolvedValue(
				jsonResponse({
					success: true,
					result: [
						{
							name: "agricoltura",
							title: "Agricoltura",
							description: "Agricoltura, pesca, silvicoltura",
							package_count: 53,
						},
						{
							name: "energia",
							title: "Energia",
							description: "Energia",
							package_count: 4,
						},
					],
				}),
			);
			const client = await connectClient();

			const result = await client.callTool({
				name: "group_list",
				arguments: {},
			});

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toEqual({
				groups: [
					{
						name: "agricoltura",
						title: "Agricoltura",
						description: "Agricoltura, pesca, silvicoltura",
						packageCount: 53,
					},
					{
						name: "energia",
						title: "Energia",
						description: "Energia",
						packageCount: 4,
					},
				],
			});
			const [requestedUrl] = fetchMock.mock.calls[0] as [URL];
			expect(requestedUrl.toString()).toContain("group_list?all_fields=true");
		});

		it("surfaces CKAN errors as tool errors", async () => {
			fetchMock.mockResolvedValue(
				jsonResponse({ success: false, error: { message: "boom" } }, 500),
			);
			const client = await connectClient();

			const result = await client.callTool({
				name: "group_list",
				arguments: {},
			});

			expect(result.isError).toBe(true);
		});
	});

	describe("group_show", () => {
		it("returns a slim theme + dataset list from CKAN's group_show action", async () => {
			fetchMock.mockResolvedValue(
				jsonResponse({
					success: true,
					result: {
						name: "agricoltura",
						title: "Agricoltura",
						description: "Agricoltura, pesca, silvicoltura",
						package_count: 2,
						packages: [
							{
								id: "2624396e-e685-4d04-a1f2-4b64958653ba",
								name: "permessi-licenza-pesca",
								title: "Permessi licenza pesca",
								notes: "should be stripped out",
							},
							{
								id: "634fa522-571e-46a5-92e5-5e00ef50199f",
								name: "tesserini-raccolta-funghi",
								title: "tesserini raccolta funghi",
							},
						],
						users: [{ name: "awckan" }],
					},
				}),
			);
			const client = await connectClient();

			const result = await client.callTool({
				name: "group_show",
				arguments: { id: "agricoltura" },
			});

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toEqual({
				name: "agricoltura",
				title: "Agricoltura",
				description: "Agricoltura, pesca, silvicoltura",
				packageCount: 2,
				datasets: [
					{
						id: "2624396e-e685-4d04-a1f2-4b64958653ba",
						name: "permessi-licenza-pesca",
						title: "Permessi licenza pesca",
					},
					{
						id: "634fa522-571e-46a5-92e5-5e00ef50199f",
						name: "tesserini-raccolta-funghi",
						title: "tesserini raccolta funghi",
					},
				],
			});
			const [requestedUrl] = fetchMock.mock.calls[0] as [URL];
			expect(requestedUrl.toString()).toContain("group_show?id=agricoltura");
			expect(requestedUrl.toString()).toContain("include_datasets=true");
			expect(requestedUrl.toString()).toContain("include_users=false");
		});

		it("surfaces CKAN errors as tool errors", async () => {
			fetchMock.mockResolvedValue(
				jsonResponse(
					{
						success: false,
						error: { message: "Not found" },
					},
					404,
				),
			);
			const client = await connectClient();

			const result = await client.callTool({
				name: "group_show",
				arguments: { id: "does-not-exist" },
			});

			expect(result.isError).toBe(true);
		});
	});
});
