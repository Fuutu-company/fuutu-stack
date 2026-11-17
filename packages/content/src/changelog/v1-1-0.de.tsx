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
				<li>
					Security-Härtung nach einem vollständigen Review von Auth, Admin, API,
					Payments, Storage, Headern und CI: geschlossene
					Better-Auth-Organisations- und Admin-Endpunkte, Gates für verifizierte
					E-Mail und frische Sitzung bei API-Schlüsseln, Passkeys, 2FA,
					MCP-Consent und E-Mail-Änderung, rückabgewickelte Erstattungen und
					Disputes, an die validierte IP gebundene Webhook-Zustellung,
					Zugriffsprüfung pro Objekt im Image-Proxy, ein Limit für Request-Bodys
					und gehärtete Response-Header. Alle Auth-Sicherheitsregeln laufen über
					ein Modul, <code>packages/auth/src/security/index.ts</code>, das jede
					Regel, ihre Pfade und ihren Konfigurationsschalter auflistet.
				</li>
				<li>
					Payments: Das Billing-Portal öffnet nur für den Zahler, Stripe
					aktiviert nur bei bezahlten Checkouts, vollständige Erstattungen und
					Disputes werden bei jedem Provider rückgängig gemacht (zu früh
					eintreffende werden wiederholt), Testphasen laufen einmal pro Nutzer
					und Organisation, Organisations-Checkouts rechnen mindestens die
					Mitgliederzahl ab (täglicher Job <code>seat-reconcile</code>) und
					derselbe Plan lässt sich nicht doppelt kaufen. Neuer Erweiterungspunkt{" "}
					<code>registerSeatGate</code>; <code>createCheckoutLink</code> liefert
					zusätzlich die <code>checkoutId</code> des Providers.
				</li>
				<li>
					<code>apiConfig.apiKeyMaxLifetimeDays</code> begrenzt die Laufzeit von
					API-Schlüsseln (ungesetzt: keine Grenze); <code>requireScopes()</code>{" "}
					aus <code>@fuutu/mcp</code> beschränkt MCP-Tools auf OAuth-Scopes.
				</li>
				<li>
					Die Architektur-Guards sind getrennt: <code>arch/*</code> in{" "}
					<code>@fuutu/test-utils</code> sind Kit-Invarianten und laufen in
					jedem <code>pnpm test</code>; <code>arch/kit-source/*</code> prüfen
					die Demo-Dateien und das CI-Layout des Kits und laufen nur im
					Kit-Repository (<code>pnpm -F @fuutu/test-utils test:kit-source</code>
					) — du kannst deine UI und CI ändern, ohne rote Tests.
				</li>
			</ul>
			<h3>Änderungen</h3>
			<ul>
				<li>
					<code>LICENSE.md</code> ist die Fuutu Business License 1.3: Preise
					sind nicht mehr Teil der Lizenz (es gilt die veröffentlichte
					Preisseite), und Beiträge folgen den Bedingungen in{" "}
					<code>CONTRIBUTING.md</code> (MIT-0 und Developer Certificate of
					Origin per Sign-off).
				</li>
				<li>
					Telemetrie sendet nur noch die fünf Felder aus LICENSE.md §7:{" "}
					<code>kitName</code>, <code>kitVersion</code>,{" "}
					<code>licenseKeyHash</code>, <code>appUrl</code> und das neue{" "}
					<code>kind</code> (<code>build</code> oder <code>runtime</code>).{" "}
					<code>nodeVersion</code>, <code>platform</code>, <code>features</code>{" "}
					und <code>sentAt</code> entfallen. Pings kommen nur aus CI- oder
					Production-Builds und aus Production-Laufzeiten — nie von einem
					Dev-Server oder einem einfachen lokalen Build.
				</li>
				<li>
					<code>config.features.legalPages</code> (neu, standardmäßig an)
					verlinkt Impressum und Datenschutzerklärung der Marketing-Seite von
					den Auth-Seiten und dem Nutzermenü der SaaS-App, der Docs-Sidebar und
					dem Consent-Banner.
				</li>
				<li>
					<code>APP_PUBLIC_PREFIXES</code> in <code>proxy-public.ts</code> nimmt
					auch <code>{'{ exact: "/pfad" }'}</code> für einen einzelnen
					öffentlichen Pfad; ein String-Eintrag passt weiter als Präfix.
				</li>
				<li>
					Port-Slots: <code>pnpm ports release [pfad]</code> gibt den Slot eines
					Projekts frei, <code>pnpm ports prune</code> listet Slots, deren
					Ordner fehlt (und entfernt sie mit <code>--yes</code>) — beide bieten
					an, die lokale Datenbank und die Buckets des Slots zu löschen.{" "}
					<code>pnpm dev:session reset</code> startet die Apps mit leerem
					Turbopack-Dev-Cache neu.
				</li>
				<li>
					Zahlungsanbieter melden typisierte Fehler (
					<code>ProviderRequestError</code> mit <code>kind</code>{" "}
					<code>not_found</code>, <code>invalid_state</code>,{" "}
					<code>rejected</code> oder <code>unavailable</code>); die API reicht
					die Art weiter, und die Billing-Ansichten zeigen eine passende
					Meldung.
				</li>
			</ul>
			<h3>Fixes</h3>
			<ul>
				<li>
					Während einer Impersonation sind Billing-Aktionen und das Anlegen von
					API-Keys von vornherein deaktiviert, mit Begründung, und jede
					Ablehnung sagt „Nicht verfügbar, solange du als dieser Nutzer
					angemeldet bist (Impersonation)“ statt eines allgemeinen Fehlers.
					Fehler von <code>denyImpersonation</code> tragen{" "}
					<code>data.code: "IMPERSONATION_FORBIDDEN"</code>, wie der Guard von
					Better Auth.
				</li>
				<li>
					Seiten einer fremden Organisation antworten Nicht-Mitgliedern mit 404,
					bevor die App-Shell rendert — kein „Etwas ist schiefgelaufen“, kein
					Organisationsname.
				</li>
				<li>
					Das Onboarding macht nach einem Neuladen beim erreichten Schritt
					weiter und überspringt im erzwungenen Organisationsmodus den
					Organisationsschritt, sobald der Nutzer Mitglied einer Organisation
					ist — eine Registrierung legt nicht mehr mehrere Organisationen an.
				</li>
				<li>
					<code>/auth/verify-email-change</code> meldet Erfolg nur, wenn die
					Session die neue E-Mail trägt; <code>/auth/reset-password</code> prüft
					den Token vorab und bietet einen neuen Link an, wenn er fehlt,
					unbekannt oder abgelaufen ist.
				</li>
				<li>
					Breadcrumbs von Organisationen zeigen den Namen der Organisation,
					nicht ihren Slug.
				</li>
				<li>
					Der Billing-Tab der Admin-Nutzerseite listet die Organisationen des
					Nutzers mit Tarif und Käufen, neben den persönlichen Käufen.
				</li>
				<li>
					<code>/robots.txt</code> ist als exakter Pfad öffentlich, nicht als
					Präfix.
				</li>
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
					Telemetrie-Payload und -Bedingungen: Ein Empfänger oder Proxy, der{" "}
					<code>nodeVersion</code>, <code>platform</code>, <code>features</code>{" "}
					oder <code>sentAt</code> erwartet hat, bekommt stattdessen{" "}
					<code>kind</code>. Lokale Builds und Dev-Server pingen nicht mehr;
					setze <code>CI</code> oder <code>NODE_ENV=production</code> für einen
					Build, der pingen soll (Docker-Builds zählen als Production).{" "}
					<code>FUUTU_TELEMETRY_DISABLED=1</code> schaltet sie weiterhin nur für
					Nicht-Production-Instanzen ab (LICENSE.md §7).
				</li>
				<li>
					<code>requireOrgMembership</code> antwortet bei unbekannter
					Organisation oder Nicht-Mitgliedschaft mit 404 (
					<code>notFound()</code>) statt auf <code>/organizations</code>{" "}
					weiterzuleiten.
				</li>
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
					einer neuen Mutation in diesen Modulen der Schutz fehlt. Der
					Namensschritt im Onboarding ist während einer Impersonation gesperrt
					und verweist den Support auf die Admin-Seite des Benutzers.
				</li>
				<li>
					Eine Impersonation endet nach{" "}
					<code>authConfig.admin.impersonationMinutes</code>, gezählt ab ihrem
					Start: Die Sitzung wird gelöscht, das Ende auditiert (
					<code>admin.user.impersonate_expired</code>) und der Admin abgemeldet.
				</li>
				<li>
					Eine Impersonation endet außerdem, sobald der übernehmende Admin
					herabgestuft, gesperrt oder gelöscht wird: Die Sitzung wird gelöscht,
					das Ende einmal auditiert (
					<code>admin.user.impersonate_ended_lost_access</code>) und der Browser
					abgemeldet — eine wiederhergestellte Rolle belebt sie nicht wieder,
					auch nicht über die im Cookie zwischengespeicherte Sitzung.
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
				<li>
					<strong>Deployment:</strong> <code>TRUST_PROXY_HEADERS</code> ist in
					Produktion Pflicht (<code>0</code> oder <code>1</code>). Hinter einem
					Proxy, der <code>X-Forwarded-For</code> schreibt (Coolify, Traefik),
					setze <code>1</code>; hinter einem CDN zusätzlich{" "}
					<code>TRUSTED_CLIENT_IP_HEADER</code> (z. B.{" "}
					<code>cf-connecting-ip</code>). Die Compose-Dateien verlangen es
					ausdrücklich.
				</li>
				<li>
					<strong>Deployment:</strong> Produktion lehnt den{" "}
					<code>BETTER_AUTH_SECRET</code>-Wert ab, der früher in{" "}
					<code>.env.example</code> stand (öffentliche Git-Historie), ebenso
					jedes Secret unter 32 Zeichen und eine <code>BETTER_AUTH_URL</code>{" "}
					ohne https. Rotiere das Secret, falls ein Deployment je den alten Wert
					nutzte.
				</li>
				<li>
					<strong>Deployment:</strong> CORS mit Credentials ist Opt-in (
					<code>CORS_CREDENTIALS=1</code>; <code>CORS_ORIGIN</code> wird nur
					damit vertraut), und die Compose-Dateien veröffentlichen ihre Ports
					nur auf <code>127.0.0.1</code>. Das Seeden des Docker-Host-
					<code>postgres</code> braucht <code>FUUTU_ALLOW_SEED=1</code>.
				</li>
				<li>
					Better-Auth-Organisationsmutationen (
					<code>authClient.organization.create</code>, <code>update</code>,{" "}
					<code>delete</code>, <code>inviteMember</code>,{" "}
					<code>updateMemberRole</code>, <code>removeMember</code>,{" "}
					<code>cancelInvitation</code>, <code>listInvitations</code>) sind über
					HTTP geschlossen; nutze die oRPC-Prozeduren. Um sie zu behalten, setze{" "}
					<code>authConfig.organizations.exposeAuthEndpoints: true</code>.
					Einladungen aufzulisten braucht <code>INVITE_MEMBER</code>.
				</li>
				<li>
					Die Admin-Aktion „E-Mail als verifiziert markieren“ ist durch ein
					auditiertes „Verifizierungs-E-Mail senden“ ersetzt (
					<code>admin.users.sendVerificationEmail</code>);{" "}
					<code>admin.users.update</code> akzeptiert nur noch{" "}
					<code>emailVerified: false</code>.
				</li>
				<li>
					Das Anlegen von API-Schlüsseln, die Passkey-Registrierung, das
					Aktivieren von 2FA, der MCP-OAuth-Consent und eine E-Mail-Änderung
					setzen eine verifizierte E-Mail voraus. API-Schlüssel, Passkeys, eine
					E-Mail-Änderung und das Löschen eines Kontos ohne Passwort brauchen
					zusätzlich eine frische Sitzung (
					<code>authConfig.session.freshSessionMaxAge</code>, 15 Minuten).
				</li>
				<li>
					<code>/delete-user</code> verlangt das Passwort, bei Konten ohne
					Passwort eine frische Sitzung; es lehnt alleinige Owner ab und bricht
					ab, wenn das Kündigen eines Abos fehlschlägt.
				</li>
				<li>
					Eine E-Mail-Änderung wird an der aktuellen Adresse bestätigt, die alte
					Adresse erhält eine Benachrichtigung. Ein Passwort-Reset widerruft
					Sitzungen, OAuth-Tokens und API-Schlüssel (mit Audit-Eintrag).
				</li>
				<li>
					MCP <code>whoami</code> braucht die Scopes <code>profile</code> und{" "}
					<code>email</code> auf OAuth-Tokens; API-Key-Principals sind nicht
					betroffen.
				</li>
				<li>
					Webhooks anlegen, ändern und löschen ist Admin-Stufe und nur per
					Sitzung möglich; gespeicherte Antworten der Empfänger werden nie
					zurückgegeben.
				</li>
				<li>
					<code>createCheckoutLink</code> liefert{" "}
					<code>{"{ url, checkoutId? }"}</code> statt eines Strings; ein
					Checkout für denselben Plan bei einem zur Kündigung vorgemerkten Abo
					antwortet mit <code>resume_instead</code>.
				</li>
			</ul>
		</>
	);
}
