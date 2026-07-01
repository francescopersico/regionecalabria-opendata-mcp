#!/usr/bin/env node
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

const MCP_ENDPOINT_PATH = "/mcp";
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";

const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
const host = process.env.HOST ?? DEFAULT_HOST;

// `createMcpExpressApp` binds host header / DNS rebinding protection based
// on the host we intend to listen on, guarding against DNS rebinding
// attacks against locally running MCP servers.
const app = createMcpExpressApp({ host });

/**
 * This server runs in stateless mode (`sessionIdGenerator: undefined`):
 * every request gets a fresh server + transport pair and no session state
 * is kept between calls. This is sufficient for a server that only exposes
 * a single, side-effect-free `get_version` tool.
 */
app.post(MCP_ENDPOINT_PATH, async (req: Request, res: Response) => {
	try {
		const server = createServer();
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});

		res.on("close", () => {
			transport.close();
			server.close();
		});

		await server.connect(transport);
		await transport.handleRequest(req, res, req.body);
	} catch (error: unknown) {
		console.error("Error handling MCP request:", error);
		if (!res.headersSent) {
			res.status(500).json({
				jsonrpc: "2.0",
				error: { code: -32603, message: "Internal server error" },
				id: null,
			});
		}
	}
});

function methodNotAllowed(_req: Request, res: Response): void {
	res.status(405).json({
		jsonrpc: "2.0",
		error: { code: -32000, message: "Method not allowed." },
		id: null,
	});
}

// This stateless server has no server-to-client notifications or session
// termination, so GET (SSE stream) and DELETE (session close) are not
// supported on the MCP endpoint.
app.get(MCP_ENDPOINT_PATH, methodNotAllowed);
app.delete(MCP_ENDPOINT_PATH, methodNotAllowed);

const httpServer = app.listen(port, host, () => {
	console.error(
		`regionecalabria-opendata-mcp listening on http://${host}:${port}${MCP_ENDPOINT_PATH} (Streamable HTTP, stateless)`,
	);
});

function shutdown(): void {
	console.error("Shutting down MCP HTTP server...");
	httpServer.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
