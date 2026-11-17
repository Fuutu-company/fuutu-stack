export default function ChangelogV111De() {
	return (
		<>
			<h3>Fixes</h3>
			<ul>
				<li>
					Organisationsbezogene Procedures antworten einem angemeldeten Nutzer,
					der kein Mitglied ist, mit <code>403 FORBIDDEN</code> statt mit einem
					500.
				</li>
				<li>
					Visual-Regression-Baselines werden nur noch überschrieben, wenn ein
					Screenshot die Toleranz von 0,5 % überschreitet (
					<code>--update-snapshots=changed</code>); der Seed nutzt feste IDs für
					die Seed-Nutzer und die Acme-Organisation — keine reinen
					Baseline-Bot-Commits mehr.
				</li>
			</ul>
			<h3>API-Änderungen</h3>
			<ul>
				<li>
					<code>users.updateProfile</code> akzeptiert nur noch <code>null</code>{" "}
					oder den eigenen Upload unter{" "}
					<code>/image-proxy/avatars/&lt;userId&gt;/…</code>. Externe
					Avatar-URLs werden abgelehnt. Die Kit-UI ruft diese Procedure nicht
					auf.
				</li>
			</ul>
		</>
	);
}
