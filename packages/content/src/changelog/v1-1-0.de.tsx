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
				<li>
					<code>appDocs.Home</code> ersetzt den Inhalt der Docs-Startseite im
					Kit-Home-Layout (Navigation, Suche, Theme und Sprache bleiben vom
					Kit).
				</li>
				<li>
					Schlichte Icons: Icons erscheinen als reine Linien in einer Textfarbe
					oder Bereichsfarbe, nie auf runden oder gefüllten Flächen (DESIGN.md,
					Iconography). Der <code>icon-chip-guard</code> hält solche Flächen
					fern und führt echte Avatare, Zähler und Controls mit Begründung.
				</li>
				<li>
					<code>SecretRevealDialog</code> (<code>@fuutu/ui</code>) zeigt einen
					Schlüssel oder ein Geheimnis genau einmal: vollständig und umbrochen,
					markierbar, und ein Klick daneben schließt ihn nicht. Schlägt das
					Kopieren fehl, wird das Geheimnis markiert und ein Hinweis erscheint,
					statt eines Fehlers. Neue API-Schlüssel und Webhook-Geheimnisse nutzen
					ihn.
				</li>
				<li>
					API-Schlüssel lassen sich überall mit <code>CreateApiKeyButton</code>{" "}
					anlegen (Anlegen-Dialog, dann die Anzeige): <code>presetScopes</code>,{" "}
					<code>triggerLabel</code>, <code>triggerVariant</code> und ein{" "}
					<code>createdHint</code> unter dem Schlüssel. Der Anlegen-Dialog
					startet bei jedem Öffnen leer. <code>ApiKeyList</code> nimmt{" "}
					<code>variant="section"</code>, <code>scope</code> (listet nur
					Schlüssel mit diesem Scope und belegt neue damit vor),{" "}
					<code>manageHref</code> und <code>createdHint</code>;{" "}
					<code>ApiKeyStatusBadge</code> wird exportiert.{" "}
					<code>apiKeys.list</code> akzeptiert einen <code>scope</code>-Filter.
				</li>
				<li>
					<code>AppOrgSettingsNavItem.replaces</code> setzt einen App-Eintrag an
					die Stelle eines Kit-Eintrags der Organisationseinstellungen (z. B.
					eine Seite „Keys“ statt „API-Schlüssel“), ohne Kit-Texte
					umzuschreiben; die Kit-Route funktioniert weiter.
				</li>
				<li>
					System-Admin-Bereich unter <code>/admin</code>: Nutzer und
					Organisationen (Suche, Detailseiten, Support-Aktionen mit Begründung),
					Impersonation mit Zeitlimit und Banner, ein filterbares Audit-Log und
					eine schreibgeschützte Systemstatus-Seite. Jede Aktion läuft über die
					auditierten <code>admin.*</code>-oRPC-Prozeduren; unumkehrbare
					(Sperren, Rolle setzen, Löschen, Impersonation) schreiben ihren
					Audit-Eintrag, bevor sie laufen, und einen <code>_failed</code>
					-Eintrag, wenn sie danach scheitern. Neue Konfiguration:{" "}
					<code>authConfig.admin.impersonationMinutes</code> (Standard 60),{" "}
					<code>authConfig.organizations.invitationExpiresIn</code> (Standard 48
					h) und <code>authConfig.admin.exposeAuthEndpoints</code> (Standard{" "}
					<code>false</code>).
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
				<li>
					Das Marketing-Layout schneidet Schatten und Fokusring der letzten
					Karte einer Seite nicht mehr ab (<code>main</code> nutzt{" "}
					<code>overflow-x-clip</code>).
				</li>
				<li>
					Dialoge passen auf den Bildschirm: 16 px Abstand auf dem Handy, eine
					maximale Höhe mit Scrollen, Abstand zwischen gestapelten
					Footer-Buttons, und die Inhaltsspalte wächst nicht mehr über den
					Dialog hinaus (ein langer API-Schlüssel schob „Habe ich kopiert“ nach
					draußen).
				</li>
				<li>
					Die API-Schlüssel-Listen zeigen alle Schlüssel: 100 pro Seite mit
					„Mehr laden“, statt still bei 50 aufzuhören.
				</li>
				<li>
					Die Beschreibung des <code>versioning</code>-Scopes sagt, wofür er da
					ist: einen Release-Workflow die nächste App-Version berechnen lassen.
				</li>
				<li>
					Ein Widerruf der Einwilligung stoppt auch ein bereits geladenes
					Analytics-Script: über <code>installConsentGate</code> des Providers
					oder, wenn er keinen hat, durch ein Neuladen der Seite. Selbst
					gehostetes Umami braucht v2.18.0 oder neuer, damit der Widerspruch
					auch das Auto-Tracking stoppt (<code>data-before-send</code>).
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
				<li>
					<code>AreaIcon</code> zeichnet das Icon in der Bereichsfarbe ohne
					Fläche und Rundung (16 px <code>sm</code>, 20 px <code>md</code>).
					<code>AreaCutoutIcon</code> im Marketing entfällt; die Hero-Karten
					nutzen <code>AreaIcon</code>. Visual-Baselines neu erzeugen.
				</li>
				<li>
					Sicherheit: Mitglieder einer Organisation können fremde
					Organisations-API-Schlüssel nicht mehr widerrufen oder löschen, auch
					nicht die eines Admins. <code>PERMISSIONS.API_KEY.DELETE</code> liegt
					in <code>ORG_POLICY</code> jetzt bei Admins statt bei Mitgliedern; ein
					Mitglied widerruft weiterhin die Schlüssel, die es selbst angelegt
					hat. Einträge von <code>apiKeys.list</code> tragen{" "}
					<code>canRevoke</code>, und die Liste zeigt „Widerrufen“ nur dort.
				</li>
				<li>
					<code>DialogContent</code> hat standardmäßig{" "}
					<code>max-w-[calc(100%-2rem)] sm:max-w-lg</code>. Breite mit{" "}
					<code>sm:max-w-*</code> überschreiben; ein bloßes <code>max-w-*</code>{" "}
					entfernt den Abstand auf dem Handy. Visuelle Baselines aktualisieren.
				</li>
				<li>
					<code>adminProcedure</code> ist{" "}
					<code>systemAdminProcedure(PERMISSIONS.VIEW_ADMIN)</code>: Rolle und
					Sperre des Aufrufers werden bei jedem Aufruf aus der Datenbank
					gelesen, API-Schlüssel und Impersonation-Sitzungen bekommen 403, egal
					mit welchen Scopes.
				</li>
				<li>
					Die Admin-Endpunkte von Better Auth (<code>/api/auth/admin/*</code>,{" "}
					<code>authClient.admin.*</code>) antworten mit 404 und stehen nicht
					mehr in <code>/api/docs</code>. Stattdessen die <code>admin.*</code>
					-Prozeduren aufrufen (z. B. <code>admin.users.ban</code>,{" "}
					<code>admin.users.setRole</code>, <code>admin.users.impersonate</code>
					). Wer die alten Endpunkte behalten will, setzt{" "}
					<code>authConfig.admin.exposeAuthEndpoints: true</code> — sie umgehen
					dann Begründung, Audit-Eintrag und Schutzregeln der Prozeduren.
				</li>
				<li>
					Impersonation-Sitzungen werden von den Mutationen für Payments,
					API-Schlüssel, Webhooks und Organisationen (
					<code>denyImpersonation</code>) und von{" "}
					<code>users.updateProfile</code> abgewiesen; die Better-Auth-Endpunkte
					für Konto, 2FA, Passkeys, Organisationen, <code>/update-user</code>{" "}
					und das Beenden von Sitzungen antworten mit 403 (
					<code>IMPERSONATION_FORBIDDEN</code>). Ein Test schlägt fehl, wenn
					einer neuen Mutation in diesen Modulen der Schutz fehlt.
				</li>
				<li>
					Eine Impersonation endet nach{" "}
					<code>authConfig.admin.impersonationMinutes</code>, gezählt ab ihrem
					Start: Die Sitzung wird gelöscht, das Ende auditiert (
					<code>admin.user.impersonate_expired</code>) und der Admin abgemeldet.
				</li>
				<li>
					Eine befristete Sperre endet bei <code>banExpires</code>:
					Server-Guards, API und Admin-Badges behandeln eine abgelaufene Sperre
					als aufgehoben (<code>isBanActive</code> aus{" "}
					<code>@fuutu/auth/types</code>).
				</li>
				<li>
					Die Admin-Gruppe der Seitenleiste zeigt Nutzer, Organisationen,
					Audit-Logs und System in dieser Reihenfolge. Ein App-Eintrag mit{" "}
					<code>after: "adminUsers"</code> steht jetzt vor Organisationen.
				</li>
			</ul>
		</>
	);
}
