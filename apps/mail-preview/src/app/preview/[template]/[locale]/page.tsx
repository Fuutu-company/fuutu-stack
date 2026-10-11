import type { Locale } from "@fuutu/i18n";
import type { TemplateName } from "@fuutu/mail/templates";
import { notFound } from "next/navigation";
import { LOCALES, renderFixture, TEMPLATES } from "../../../../fixtures";

interface Params {
	template: string;
	locale: string;
}

export default async function PreviewPage({
	params,
}: {
	params: Promise<Params>;
}) {
	const { template, locale } = await params;

	if (!(TEMPLATES as string[]).includes(template)) {
		notFound();
	}
	if (!(LOCALES as readonly string[]).includes(locale)) {
		notFound();
	}

	const name = template as TemplateName;
	const rendered = renderFixture(name, locale as Locale);

	return (
		<main style={{ padding: 16 }}>
			<nav
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					marginBottom: 12,
					fontSize: 13,
					color: "#374151",
				}}
			>
				<a href="/" style={{ color: "#2563eb", textDecoration: "none" }}>
					← all templates
				</a>
				<span style={{ color: "#9ca3af" }}>|</span>
				<strong>{name}</strong>
				<span style={{ color: "#9ca3af" }}>·</span>
				<span>{locale}</span>
				<span style={{ color: "#9ca3af" }}>·</span>
				<span style={{ color: "#6b7280" }}>{rendered.subject}</span>
				<span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
					{LOCALES.filter((l: string) => l !== locale).map((l: string) => (
						<a
							key={l}
							href={`/preview/${name}/${l}`}
							style={{
								color: "#2563eb",
								textDecoration: "none",
								fontWeight: 500,
							}}
						>
							switch to {l}
						</a>
					))}
				</span>
			</nav>

			<iframe
				title={`${name} (${locale})`}
				srcDoc={rendered.html}
				sandbox=""
				style={{
					width: "100%",
					minHeight: "calc(100vh - 140px)",
					border: "1px solid #e5e7eb",
					borderRadius: 8,
					background: "#fff",
				}}
			/>

			<details style={{ marginTop: 16 }}>
				<summary style={{ cursor: "pointer", fontSize: 13, color: "#6b7280" }}>
					Plain-text version
				</summary>
				<pre
					style={{
						background: "#f9fafb",
						border: "1px solid #e5e7eb",
						borderRadius: 8,
						padding: 12,
						fontSize: 13,
						whiteSpace: "pre-wrap",
					}}
				>
					{rendered.text}
				</pre>
			</details>
		</main>
	);
}

export const dynamic = "force-dynamic";
