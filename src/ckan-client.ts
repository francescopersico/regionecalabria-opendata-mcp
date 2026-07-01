/**
 * Minimal client for the CKAN Action API (v3), used to talk to the
 * Regione Calabria open data portal (or any compatible CKAN instance).
 *
 * @see https://docs.ckan.org/en/latest/api/index.html
 */

const DEFAULT_CKAN_BASE_URL =
	"https://dati.regione.calabria.it/opendata/api/3/action";

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Base URL of the CKAN Action API, e.g.
 * `https://dati.regione.calabria.it/opendata/api/3/action`.
 * Configurable via the `CKAN_BASE_URL` environment variable so this
 * server can be pointed at another CKAN portal (or a test double)
 * without code changes.
 */
export function getCkanBaseUrl(): string {
	const configured = process.env.CKAN_BASE_URL?.trim();
	return configured && configured.length > 0
		? configured.replace(/\/+$/, "")
		: DEFAULT_CKAN_BASE_URL;
}

/**
 * Shape of every CKAN Action API JSON response.
 * @see https://docs.ckan.org/en/latest/api/index.html#making-an-api-request
 */
interface CkanActionResponse<T> {
	readonly success: boolean;
	readonly result?: T;
	readonly error?: {
		readonly message?: string;
		readonly __type?: string;
	};
}

/**
 * Error thrown when a CKAN Action API call fails, either at the HTTP
 * transport level or because CKAN itself reported `"success": false`.
 */
export class CkanApiError extends Error {
	constructor(
		message: string,
		readonly action: string,
	) {
		super(message);
		this.name = "CkanApiError";
	}
}

/**
 * Calls a GET-able CKAN Action API function (e.g. `package_list`,
 * `package_show`, `package_search`) and returns its `result` payload.
 *
 * @param action Name of the CKAN action, e.g. `"package_show"`.
 * @param params Query parameters for the action; `undefined` values are omitted.
 */
export async function callCkanAction<T>(
	action: string,
	params: Record<string, string | number | undefined> = {},
): Promise<T> {
	const url = new URL(`${getCkanBaseUrl()}/${action}`);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined) {
			url.searchParams.set(key, String(value));
		}
	}

	let response: Response;
	try {
		response = await fetch(url, {
			method: "GET",
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch (cause) {
		throw new CkanApiError(
			`Network error calling CKAN action "${action}": ${(cause as Error).message}`,
			action,
		);
	}

	let body: CkanActionResponse<T>;
	try {
		body = (await response.json()) as CkanActionResponse<T>;
	} catch {
		throw new CkanApiError(
			`CKAN action "${action}" returned a non-JSON response (HTTP ${response.status}).`,
			action,
		);
	}

	if (!response.ok || !body.success) {
		const detail = body.error?.message ?? `HTTP ${response.status}`;
		throw new CkanApiError(`CKAN action "${action}" failed: ${detail}`, action);
	}

	if (body.result === undefined) {
		throw new CkanApiError(
			`CKAN action "${action}" succeeded but returned no result.`,
			action,
		);
	}

	return body.result;
}
