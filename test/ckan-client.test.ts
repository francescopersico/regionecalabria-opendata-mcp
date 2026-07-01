import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import {
	CkanApiError,
	callCkanAction,
	getCkanBaseUrl,
} from "../src/ckan-client.js";

describe("getCkanBaseUrl", () => {
	const originalEnv = process.env.CKAN_BASE_URL;

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.CKAN_BASE_URL;
		} else {
			process.env.CKAN_BASE_URL = originalEnv;
		}
	});

	it("defaults to the Regione Calabria CKAN API", () => {
		delete process.env.CKAN_BASE_URL;
		expect(getCkanBaseUrl()).toBe(
			"https://dati.regione.calabria.it/opendata/api/3/action",
		);
	});

	it("uses CKAN_BASE_URL when set, trimming trailing slashes", () => {
		process.env.CKAN_BASE_URL = "https://example.test/api/3/action/";
		expect(getCkanBaseUrl()).toBe("https://example.test/api/3/action");
	});

	it("falls back to the default when CKAN_BASE_URL is blank", () => {
		process.env.CKAN_BASE_URL = "   ";
		expect(getCkanBaseUrl()).toBe(
			"https://dati.regione.calabria.it/opendata/api/3/action",
		);
	});
});

describe("callCkanAction", () => {
	let fetchMock: MockInstance<typeof fetch>;

	beforeEach(() => {
		fetchMock = vi.fn() as unknown as MockInstance<typeof fetch>;
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function jsonResponse(body: unknown, status = 200): Response {
		return new Response(JSON.stringify(body), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	}

	it("returns the result on a successful response", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({ success: true, result: ["a", "b"] }),
		);

		const result = await callCkanAction<string[]>("package_list");

		expect(result).toEqual(["a", "b"]);
	});

	it("builds the request URL with the action and query params", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ success: true, result: [] }));

		await callCkanAction("package_list", { limit: 5, offset: undefined });

		const [requestedUrl] = fetchMock.mock.calls[0] as [URL];
		expect(requestedUrl.toString()).toBe(
			"https://dati.regione.calabria.it/opendata/api/3/action/package_list?limit=5",
		);
	});

	it("throws CkanApiError when CKAN reports success: false", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({
				success: false,
				error: { message: "Not found", __type: "Not Found Error" },
			}),
		);

		await expect(
			callCkanAction("package_show", { id: "missing" }),
		).rejects.toThrow(CkanApiError);
	});

	it("throws CkanApiError on a non-2xx HTTP response", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ success: false }, 500));

		await expect(callCkanAction("package_list")).rejects.toThrow(CkanApiError);
	});

	it("throws CkanApiError when the response body is not JSON", async () => {
		fetchMock.mockResolvedValue(
			new Response("<html>not json</html>", { status: 200 }),
		);

		await expect(callCkanAction("package_list")).rejects.toThrow(CkanApiError);
	});

	it("throws CkanApiError on a network failure", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		await expect(callCkanAction("package_list")).rejects.toThrow(CkanApiError);
	});
});
