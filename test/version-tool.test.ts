import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { getPackageMetadata } from "../src/package-metadata.js";
import { createServer } from "../src/server.js";

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { name: string; version: string };

describe("getPackageMetadata", () => {
	it("reads the name and version from package.json", () => {
		expect(getPackageMetadata()).toEqual({
			name: packageJson.name,
			version: packageJson.version,
		});
	});
});

describe("get_version tool", () => {
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

	it("is exposed via tools/list", async () => {
		const client = await connectClient();

		const { tools } = await client.listTools();

		expect(tools.map((tool) => tool.name)).toContain("get_version");
	});

	it("returns this package's name and version", async () => {
		const client = await connectClient();

		const result = await client.callTool({
			name: "get_version",
			arguments: {},
		});

		expect(result.isError).toBeFalsy();
		expect(result.structuredContent).toEqual({
			name: packageJson.name,
			version: packageJson.version,
		});

		const [firstContentItem] = result.content as Array<{
			type: string;
			text: string;
		}>;
		expect(firstContentItem?.type).toBe("text");
		expect(JSON.parse(firstContentItem?.text ?? "{}")).toEqual({
			name: packageJson.name,
			version: packageJson.version,
		});
	});
});
