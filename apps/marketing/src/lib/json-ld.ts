/**
 * Serialize structured data for an inline `<script type="application/ld+json">`.
 * Escapes `<`, `>`, `&`, U+2028 and U+2029 as `\uXXXX` so the payload can
 * neither close the script tag nor break the page; the JSON stays equal when
 * parsed.
 *
 * ```tsx
 * <script
 *   type="application/ld+json"
 *   dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
 * />
 * ```
 */
const ESCAPES: Record<string, string> = {
	"<": "\\u003c",
	">": "\\u003e",
	"&": "\\u0026",
	"\u2028": "\\u2028",
	"\u2029": "\\u2029",
};

export function serializeJsonLd(data: unknown): string {
	return JSON.stringify(data).replace(
		/[<>&\u2028\u2029]/g,
		(char) => ESCAPES[char] ?? char,
	);
}
