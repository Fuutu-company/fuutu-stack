import type { LegalDocumentFrontmatter } from "../index";

export const frontmatter: LegalDocumentFrontmatter = {
	title: "Impressum",
	updatedAt: "2026-04-26",
};

export default function ImprintDe() {
	return (
		<>
			<p>
				<strong>Platzhalter-Dokument.</strong> Ersetze dieses Impressum vor dem
				Launch durch die rechtlich korrekten Angaben deines Unternehmens. In
				Deutschland und Österreich sind die Anforderungen an ein Impressum
				gesetzlich streng geregelt (§ 5 TMG, § 5 ECG).
			</p>

			<h2>Anbieter</h2>
			<p>
				Acme GmbH
				<br />
				Musterstraße 1<br />
				12345 Musterstadt
				<br />
				Deutschland
			</p>

			<h2>Kontakt</h2>
			<p>
				E-Mail: <a href="mailto:hello@example.com">hello@example.com</a>
				<br />
				Telefon: +49 000 0000000
			</p>

			<h2>Registereintrag</h2>
			<p>
				Eintragung im Handelsregister
				<br />
				Registergericht: Amtsgericht Musterstadt
				<br />
				Registernummer: HRB 000000
				<br />
				Umsatzsteuer-ID gem. § 27a UStG: DE000000000
			</p>

			<h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
			<p>Max Mustermann (Anschrift wie oben)</p>

			<h2>Online-Streitbeilegung</h2>
			<p>
				Die Europäische Kommission stellt eine Plattform zur
				Online-Streitbeilegung bereit:{" "}
				<a
					href="https://ec.europa.eu/consumers/odr"
					target="_blank"
					rel="noreferrer"
				>
					ec.europa.eu/consumers/odr
				</a>
				. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
				vor einer Verbraucherschlichtungsstelle teilzunehmen.
			</p>
		</>
	);
}
