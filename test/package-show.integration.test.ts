import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

/**
 * Live integration test: makes a real HTTP call to the Regione Calabria
 * open data portal to sanity-check that our assumptions about the CKAN
 * Action API still hold. Unlike the rest of the test suite (which mocks
 * `fetch`), this test requires network access and depends on the portal
 * being reachable; it may be slower or flakier than the mocked tests.
 */
describe("package_show (live network integration)", () => {
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

	it("fetches a known real dataset from dati.regione.calabria.it", async () => {
		const client = await connectClient();

		const result = await client.callTool({
			name: "package_show",
			arguments: { id: "acque-minerali" },
		});

		expect(result.isError).toBeFalsy();
		const { dataset } = result.structuredContent as {
			dataset: Record<string, unknown>;
		};
		expect(dataset.name).toBe("acque-minerali");
		expect(Array.isArray(dataset.resources)).toBe(true);
	}, 20_000);
});
