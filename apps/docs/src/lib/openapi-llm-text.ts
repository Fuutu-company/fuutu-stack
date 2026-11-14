/** The parts of `page.data.getOpenAPIPageProps()` the Markdown needs. */
export type OpenAPIPageInput = {
	title: string;
	description?: string;
	props: {
		payload: { bundled: unknown };
		operations?: readonly { path: string; method: string }[];
		webhooks?: readonly { name: string; method: string }[];
	};
};

type JsonObject = Record<string, unknown>;

const SCHEMA_REF = "#/components/schemas/";

const isObject = (value: unknown): value is JsonObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const child = (value: unknown, key: string): unknown =>
	isObject(value) ? value[key] : undefined;

const json = (value: unknown) =>
	`\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;

/** `#/components/schemas/<name>` refs anywhere inside `value`. */
function collectRefs(value: unknown, into: Set<string>): void {
	if (Array.isArray(value)) {
		for (const item of value) collectRefs(item, into);
		return;
	}
	if (!isObject(value)) return;
	for (const [key, entry] of Object.entries(value)) {
		if (key === "$ref" && typeof entry === "string") {
			if (entry.startsWith(SCHEMA_REF))
				into.add(entry.slice(SCHEMA_REF.length));
		} else {
			collectRefs(entry, into);
		}
	}
}

function operationSection(
	heading: string,
	pathItem: unknown,
	method: string,
): { markdown: string; body: JsonObject } | null {
	const operation = child(pathItem, method.toLowerCase());
	if (!isObject(operation)) return null;
	const pathParameters = child(pathItem, "parameters");
	const body: JsonObject = Array.isArray(pathParameters)
		? {
				...operation,
				parameters: [
					...pathParameters,
					...(Array.isArray(operation.parameters) ? operation.parameters : []),
				],
			}
		: operation;
	const lines = [`## ${method.toUpperCase()} ${heading}`];
	for (const key of ["summary", "description"]) {
		const text = operation[key];
		if (typeof text === "string" && text) lines.push(text);
	}
	lines.push(json(body));
	return { markdown: lines.join("\n\n"), body };
}

/**
 * Markdown of an OpenAPI page for "Copy Markdown" and the llms routes: the
 * page's operations (method, path, parameters, request body, responses as
 * JSON) followed by every component schema they reference, transitively.
 */
export function openapiLLMText({
	title,
	description,
	props,
}: OpenAPIPageInput) {
	const document = props.payload.bundled;
	const sections: string[] = [];
	const refs = new Set<string>();
	const add = (heading: string, pathItem: unknown, method: string) => {
		const section = operationSection(heading, pathItem, method);
		if (!section) return;
		sections.push(section.markdown);
		collectRefs(section.body, refs);
	};

	for (const { path, method } of props.operations ?? []) {
		add(path, child(child(document, "paths"), path), method);
	}
	for (const { name, method } of props.webhooks ?? []) {
		add(`webhook ${name}`, child(child(document, "webhooks"), name), method);
	}

	const schemas = child(child(document, "components"), "schemas");
	const schemaSections: string[] = [];
	const seen = new Set<string>();
	const queue = [...refs];
	while (queue.length > 0) {
		const name = queue.shift();
		if (name === undefined || seen.has(name)) continue;
		seen.add(name);
		const schema = child(schemas, name);
		if (schema === undefined) continue;
		schemaSections.push(`### ${name}\n\n${json(schema)}`);
		const nested = new Set<string>();
		collectRefs(schema, nested);
		queue.push(...nested);
	}
	if (schemaSections.length > 0) {
		sections.push(["## Schemas", ...schemaSections].join("\n\n"));
	}

	return [`# ${title}`, description ?? "", ...sections].join("\n\n");
}
