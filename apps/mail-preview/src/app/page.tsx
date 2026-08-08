import { LOCALES, renderFixture, TEMPLATES } from "../fixtures";

/**
 * Index page — grid of every template × locale.
 *
 * Each cell links to a dedicated preview route that renders the mail
 * HTML in an isolated iframe (so the template's own <html>/<body> do
 * not collide with this page's layout).
 */
export default function Home() {
	return (
		<main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
			<h1 style={{ fontSize: 24, marginBottom: 8 }}>Fuutu · Mail Preview</h1>
			<p style={{ color: "#6b7280", marginTop: 0 }}>
				Dev tool. Edit a template in <code>packages/mail/src/templates/</code>{" "}
				and refresh.
			</p>

			<table
				style={{
					width: "100%",
					borderCollapse: "collapse",
					background: "#fff",
					border: "1px solid #e5e7eb",
					borderRadius: 8,
					overflow: "hidden",
					marginTop: 24,
				}}
			>
				<thead>
					<tr style={{ background: "#f9fafb" }}>
						<th style={cellHead}>Template</th>
						{LOCALES.map((l) => (
							<th key={l} style={cellHead}>
								{l}
							</th>
						))}
						<th style={cellHead}>Subject (en)</th>
					</tr>
				</thead>
				<tbody>
					{TEMPLATES.map((name) => {
						const rendered = renderFixture(name, "en");
						return (
							<tr key={name} style={{ borderTop: "1px solid #e5e7eb" }}>
								<td style={cell}>
									<code>{name}</code>
								</td>
								{LOCALES.map((l) => (
									<td key={l} style={cell}>
										<a
											href={`/preview/${encodeURIComponent(name)}/${l}`}
											style={link}
										>
											open
										</a>
									</td>
								))}
								<td style={{ ...cell, color: "#6b7280" }}>
									{rendered.subject}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</main>
	);
}

const cell: React.CSSProperties = {
	padding: "12px 16px",
	fontSize: 14,
	verticalAlign: "top",
};
const cellHead: React.CSSProperties = {
	...cell,
	textAlign: "left",
	fontWeight: 600,
	fontSize: 13,
	color: "#374151",
};
const link: React.CSSProperties = {
	color: "#2563eb",
	textDecoration: "none",
	fontWeight: 500,
};

export const dynamic = "force-dynamic";
