import type { LegalDocumentFrontmatter } from "../index";

export const frontmatter: LegalDocumentFrontmatter = {
	title: "Allgemeine Geschäftsbedingungen",
	updatedAt: "2026-04-26",
};

export default function TermsDe() {
	return (
		<>
			<p>
				<strong>Platzhalter-Dokument.</strong> Dies sind Platzhalter-AGB des
				Fuutu-Stack-Starter-Kits. Ersetze sie vor der Annahme echter
				Nutzer:innen oder Zahlungen durch ein von qualifizierter Rechtsberatung
				geprüftes Dokument.
			</p>

			<h2>1. Geltungsbereich</h2>
			<p>
				Mit der Erstellung eines Kontos oder der Nutzung des Dienstes erkennst
				du diese Bedingungen an. Wenn du nicht zustimmst, nutze den Dienst bitte
				nicht.
			</p>

			<h2>2. Leistungen</h2>
			<p>
				Wir betreiben eine Software-as-a-Service-Plattform. Wir behalten uns
				vor, Funktionen zur Produktverbesserung hinzuzufügen, zu ändern oder zu
				entfernen. Wesentliche Änderungen kündigen wir mit angemessener Frist
				an.
			</p>

			<h2>3. Dein Konto</h2>
			<ul>
				<li>
					Du bist verantwortlich für die sichere Verwahrung deiner Zugangsdaten.
				</li>
				<li>
					Du musst nach deinem Recht geschäftsfähig sein, um Verträge zu
					schließen.
				</li>
				<li>
					Pro Person oder juristischer Person ist nur ein kostenloses Konto
					zulässig.
				</li>
			</ul>

			<h2>4. Zulässige Nutzung</h2>
			<p>
				Du verpflichtest dich, den Dienst nicht zu missbrauchen — keine
				rechtswidrigen Inhalte, keine Verletzung von Rechten Dritter, keine
				Störung oder Reverse-Engineering der Plattform, kein unaufgefordertes
				Massen-Messaging.
			</p>

			<h2>5. Abonnements & Zahlung</h2>
			<p>
				Kostenpflichtige Pläne werden im Voraus über unseren Zahlungsdienst
				abgerechnet. Du kannst jederzeit in deinen Abrechnungseinstellungen
				kündigen — der Plan bleibt bis zum Ende der laufenden Abrechnungsperiode
				aktiv.
			</p>

			<h2>6. Kündigung</h2>
			<p>
				Wir können Konten, die gegen diese Bedingungen verstoßen, aussetzen oder
				beenden. Du kannst dein Konto jederzeit in den Einstellungen löschen.
			</p>

			<h2>7. Haftung</h2>
			<p>
				Soweit gesetzlich zulässig, wird der Dienst „wie er ist" zur Verfügung
				gestellt. Für mittelbare oder Folgeschäden haften wir nicht.
			</p>

			<h2>8. Anwendbares Recht & Gerichtsstand</h2>
			<p>
				Es gilt das Recht des im Impressum genannten Betreibers, unter
				Ausschluss kollisionsrechtlicher Verweisungsnormen.
			</p>
		</>
	);
}
