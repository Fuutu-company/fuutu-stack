export default function ChangelogV110De() {
	return (
		<>
			<h3>Highlights</h3>
			<ul>
				<li>
					Marketing-Erweiterungspunkte: <code>app-marketing.tsx</code>{" "}
					(Home-Abschnitte per Key einfügen, ersetzen oder entfernen,
					Pricing-Cards, Seiten-Metadaten, Sitemap- und Robots-Overrides, ein
					seitenweiter Layout-Slot), <code>app-site-links.ts</code>{" "}
					(Nav-Einträge, Dropdowns, Header-Brand, Footer-Spalten, Entfernen) und{" "}
					<code>app-urls.ts</code>.
				</li>
				<li>
					Docs-Erweiterungspunkte: <code>app-docs-source.ts</code>{" "}
					(Content-Verzeichnis, Frontmatter, Code-Themes) und weitere{" "}
					<code>appDocs</code>-Hooks — Quelllink, Markdown für die llms-Routen,
					Titel-Template, OG-Bild, Sitemap, Robots und Layout-Slots.
				</li>
				<li>
					Seed- und E2E-Erweiterungspunkte:{" "}
					<code>packages/db/prisma/app-seed.ts</code> läuft nach dem Kit-Seed;{" "}
					<code>tests/app-excluded.ts</code> überspringt Kit-E2E-Tests, ohne{" "}
					<code>playwright.config.ts</code> zu ändern.
				</li>
				<li>
					Das Kit codiert keine Demo-Plan-IDs mehr fest —{" "}
					<code>getSeatPlan</code>, <code>getFreePlanId</code> und{" "}
					<code>getShowcasePlan</code> lesen deinen Plan-Katalog.
				</li>
				<li>
					KI-Chat wird über den Credit-Meter <code>ai_tokens</code> abgerechnet
					(Organisation der Konversation, sonst der User): Prüfung vor dem
					Provider-Aufruf, Verbrauch einmal pro Antwort — auch bei abgebrochenen
					Antworten — geschätzt mit 4 Zeichen pro Token. Ein gesperrter Meter
					antwortet mit 402; <code>ai_tokens</code> erlaubt Mehrverbrauch, der
					Chat läuft also weiter und erfasst ihn.
				</li>
				<li>
					Org-Konversationen setzen eine aktuelle Mitgliedschaft voraus: Ein
					ehemaliges Mitglied kann eine eigene Org-Konversation weder lesen,
					fortsetzen noch löschen und verbraucht keine Org-Credits mehr.
				</li>
				<li>
					„Copy Markdown“ auf API-Referenzseiten enthält Methode, Pfad,
					Parameter und die referenzierten Schemas.
				</li>
				<li>
					<code>/robots.txt</code> der SaaS-App verbietet das Crawlen, statt auf
					die Anmeldung umzuleiten.
				</li>
				<li>
					Testphase einmal pro Besitzer: <code>Plan.trialOnce</code>,{" "}
					<code>Plan.noTrialPriceIdEnvVars</code> (Produkte ohne Testphase, für
					Creem), <code>registerTrialEligibilityPolicy</code> und{" "}
					<code>skipTrial</code> bei <code>payments.checkout.create</code>.
					Checkout-Guards sehen die Entscheidung als <code>ctx.trial</code>; ein
					Checkout, der eine Testphase auf Produktebene überspringen muss, aber
					kein Produkt ohne Testphase hat, antwortet mit{" "}
					<code>trial_unavailable</code>.
				</li>
				<li>
					Kündigen zum Periodenende und fortsetzen:{" "}
					<code>payments.subscription.cancel</code> nimmt{" "}
					<code>atPeriodEnd</code>, <code>payments.subscription.resume</code>{" "}
					macht es rückgängig (Creem, Stripe, Polar). Sitzänderungen nehmen pro
					Aufruf eine <code>proration</code> (<code>"charge-immediately"</code>{" "}
					oder <code>"none"</code>) bei Creem und Stripe.
				</li>
				<li>
					<code>config.features.webhooks</code> schaltet ausgehende Webhooks ab:
					die Org-Einstellungsseite samt Sidebar-Eintrag, die{" "}
					<code>webhooks.*</code>-API, den Retry-Job, den Event-Versand und die
					Anzahl im Dashboard. Eingehende Zahlungs-Webhooks bleiben unberührt.
				</li>
				<li>
					<code>appContent.legal</code> ersetzt Rechtstexte des Kits pro Slug
					und Sprache oder veröffentlicht neue <code>/legal/&lt;slug&gt;</code>
					-Seiten.
				</li>
				<li>
					<code>appMarketing.sitemapExclude</code> nimmt Einträge pro Pfad und
					Sprache aus <code>/sitemap.xml</code> — Kit-Seiten, Rechtstexte,
					Blogposts und App-Routen — samt ihrer hreflang-Alternativen.
					Metadaten-Overrides nehmen <code>robots</code> an, und{" "}
					<code>metadata.blogPost</code> gilt für jeden Post unter{" "}
					<code>/blog/&lt;slug&gt;</code>.
				</li>
				<li>
					<code>appSlots.headerActions</code> zeigt App-UI in der
					Desktop-Kopfleiste direkt vor der Benachrichtigungsglocke — vom
					Server-Layout gerendert, also auch als Server-Komponente.
				</li>
				<li>
					<code>authConfig.organizations.organizationLimit</code> begrenzt, in
					wie vielen Organisationen ein Nutzer Mitglied sein darf und trotzdem
					eine weitere anlegen kann (nicht gesetzt: keine Grenze).{" "}
					<code>organizations.create</code> antwortet an der Grenze mit{" "}
					<code>FORBIDDEN</code> statt mit einem 500.
				</li>
				<li>
					Community-Hilfe gibt es jetzt in der App: README, Contributing-Guide
					und Issue-Templates verweisen auf <code>app.fuutustack.com</code>{" "}
					(Support).
				</li>
				<li>
					Das Consent-Banner hat zwei Modi. Provider, die ohne Einwilligung
					tracken (Umami), zeigen einen Hinweis — anonyme, cookielose Analytics
					laufen bereits — mit „OK“ und „Widersprechen“; der Widerspruch wird
					gespeichert und stoppt auch ein bereits geladenes Script. Provider,
					die eine Einwilligung brauchen, und{" "}
					<code>NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT=true</code> behalten
					Akzeptieren / Ablehnen. Ein Link „Datenschutz-Einstellungen“ öffnet
					das Banner erneut: im Marketing-Footer, im SaaS-Nutzermenü und auf den
					Auth-Seiten sowie in der Docs-Sidebar und auf der Docs-Startseite. Das
					Umami-Script lädt mit <code>data-do-not-track="true"</code>.
				</li>
				<li>
					<code>appMail.legalFooter</code> (
					<code>packages/mail/src/app-mail.ts</code>) fügt Firmenangaben — z. B.
					die Pflichtangaben nach § 35a GmbHG — unter jeder Transaktions-E-Mail
					ein, im HTML- und im Textteil. Ein String, eine Liste von Zeilen oder
					eine Funktion der Empfänger-Locale; nicht gesetzt, bleiben die E-Mails
					unverändert.
				</li>
				<li>
					<code>authConfig.session</code> dokumentiert die Session-Dauer für die
					Datenschutzerklärung: 30 Tage, höchstens einmal täglich verlängert, 5
					Minuten Session-Cookie-Cache.
				</li>
			</ul>
			<h3>Fixes</h3>
			<ul>
				<li>
					Ohne i18n listet die Marketing-Sitemap keine <code>/de</code>-URLs
					mehr, und Docs-Seiten geben keine hreflang-Links aus.
				</li>
				<li>
					Das Kontrast-Audit prüft die Primary-Hover-Farbe auf jeder Fläche.
				</li>
				<li>
					Das Consent-Banner fügt auf Seiten, die in den Viewport passen, keinen
					leeren Scrollraum hinzu.
				</li>
				<li>Biome prüft Dateien in Git-Worktrees.</li>
				<li>
					<code>pnpm test:visual:update</code> aktualisiert jede Visual-Spec,
					ausgewählt über den Titel.
				</li>
			</ul>
			<h3>Breaking Changes und Migration</h3>
			<ul>
				<li>
					<code>POST /api/chat/messages/stream</code> und{" "}
					<code>POST /api/ai/chat</code> antworten mit einem Event-Stream (
					<code>text/event-stream</code>) statt rohem <code>text/plain</code>:
					ein <code>message</code>-Event pro Textstück (JSON-String als Daten),
					zum Schluss ein <code>done</code>-Event; ein Fehler mitten im Stream
					kommt als <code>error</code>-Event. <code>/api/docs</code> beschreibt
					das.
				</li>
				<li>
					<code>/settings/billing</code> antwortet mit 404, solange die
					Abrechnung an Organisationen hängt (Kit-Standard) — sie liegt unter{" "}
					<code>/organizations/&lt;slug&gt;/settings/billing</code>.{" "}
					<code>assertCheckoutAllowed</code> gibt <code>{"{ trial }"}</code>{" "}
					zurück, und <code>CheckoutGuardContext</code> enthält{" "}
					<code>trial</code> und <code>skipTrial</code>.
				</li>
				<li>
					Bei Creem kündigt <code>payments.subscription.cancel</code> ohne{" "}
					<code>atPeriodEnd</code> jetzt sofort, statt den im Store
					eingestellten Kündigungsmodus zu verwenden.
				</li>
				<li>
					Eigene Consent-UIs auf Basis von <code>useConsent()</code>: das Banner
					zeigen, solange <code>open</code> wahr ist (deckt das erneute Öffnen
					und die neue Hinweis-Antwort <code>"acknowledged"</code> ab), statt{" "}
					<code>status === "unknown"</code> zu prüfen.
				</li>
			</ul>
		</>
	);
}
