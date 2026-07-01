import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Metadata read directly from this project's package.json.
 */
export interface PackageMetadata {
	readonly name: string;
	readonly version: string;
}

const currentDirectory = dirname(fileURLToPath(import.meta.url));

let cachedPackageMetadata: PackageMetadata | undefined;

/**
 * Reads and caches the `name` and `version` fields from the package.json
 * shipped alongside this server. Works both when running from source
 * (via tsx) and from the compiled `build/` output, since package.json
 * always lives exactly one directory above this file.
 */
export function getPackageMetadata(): PackageMetadata {
	if (cachedPackageMetadata) {
		return cachedPackageMetadata;
	}

	const packageJsonPath = join(currentDirectory, "..", "package.json");
	const rawPackageJson = readFileSync(packageJsonPath, "utf-8");
	const parsed: unknown = JSON.parse(rawPackageJson);

	if (
		typeof parsed !== "object" ||
		parsed === null ||
		typeof (parsed as Record<string, unknown>).name !== "string" ||
		typeof (parsed as Record<string, unknown>).version !== "string"
	) {
		throw new Error(
			`Invalid package.json at ${packageJsonPath}: missing "name" or "version" string field.`,
		);
	}

	const { name, version } = parsed as { name: string; version: string };
	cachedPackageMetadata = { name, version };
	return cachedPackageMetadata;
}
