import type { LegalDocumentFrontmatter } from "../index";

export const frontmatter: LegalDocumentFrontmatter = {
	title: "Datenschutzerklärung",
	updatedAt: "2026-04-26",
};

export default function PrivacyDe() {
	return (
		<>
			<p>
				<strong>Platzhalter-Dokument.</strong> Dies ist die deutschsprachige
				Platzhalter-Datenschutzerklärung des Fuutu-Stack-Starter-Kits. Ersetze
				sie vor dem Launch durch ein von qualifizierter Rechtsberatung geprüftes
				Dokument.
			</p>

			<h2>1. Verantwortlicher</h2>
			<p>
				Verantwortlich für diese Website ist der im{" "}
				<a href="/legal/imprint">Impressum</a> genannte Betreiber. Über die dort
				angegebenen Kontaktdaten erreichst du uns.
			</p>

			<h2>2. Welche Daten wir verarbeiten</h2>
			<ul>
				<li>
					<strong>Kontodaten</strong> — E-Mail-Adresse, gehashtes Passwort,
					Name, Organisationszugehörigkeit.
				</li>
				<li>
					<strong>Nutzungsdaten</strong> — anonyme, datenschutzfreundliche
					Analytik (nur mit Einwilligung).
				</li>
				<li>
					<strong>Technische Daten</strong> — IP-Adresse, User-Agent,
					Server-Logs (zur Abwehr von Missbrauch).
				</li>
			</ul>

			<h2>3. Zwecke der Verarbeitung</h2>
			<ul>
				<li>
					Bereitstellung des Dienstes (Vertragserfüllung, Art. 6 I b DSGVO).
				</li>
				<li>
					Produktverbesserung und Missbrauchserkennung (berechtigtes Interesse,
					Art. 6 I f DSGVO).
				</li>
				<li>
					Versand transaktionaler E-Mails sowie — nur mit Einwilligung —
					Marketing-E-Mails (Art. 6 I a DSGVO).
				</li>
			</ul>

			<h2>4. Deine Rechte</h2>
			<p>
				Du hast jederzeit das Recht auf Auskunft, Berichtigung, Löschung,
				Einschränkung, Datenübertragbarkeit und Widerspruch. Erteilte
				Einwilligungen kannst du jederzeit widerrufen. Wende dich dafür an die
				im Impressum genannten Kontaktdaten.
			</p>

			<h2>5. Cookies & Tracking</h2>
			<p>
				Standardmäßig verwenden wir ausschließlich technisch notwendige Cookies.
				Optionale Analyse-Tools werden erst nach deiner ausdrücklichen
				Einwilligung geladen.
			</p>

			<h2>6. Änderungen dieser Erklärung</h2>
			<p>
				Wir können diese Erklärung gelegentlich anpassen. Das oben angegebene
				Datum zeigt die letzte Aktualisierung.
			</p>
		</>
	);
}
