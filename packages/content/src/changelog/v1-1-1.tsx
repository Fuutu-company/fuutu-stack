export default function ChangelogV111() {
	return (
		<>
			<h3>Fixes</h3>
			<ul>
				<li>
					Org-scoped procedures answer a signed-in user who is not a member with{" "}
					<code>403 FORBIDDEN</code> instead of a 500.
				</li>
				<li>
					Visual regression baselines are only rewritten when a screenshot
					differs beyond the 0.5% tolerance (
					<code>--update-snapshots=changed</code>), and the seed uses fixed ids
					for the seeded users and the Acme org — no more baseline-only bot
					commits.
				</li>
			</ul>
			<h3>API changes</h3>
			<ul>
				<li>
					<code>users.updateProfile</code> only accepts <code>null</code> or the
					caller's own upload under{" "}
					<code>/image-proxy/avatars/&lt;userId&gt;/…</code>. External avatar
					URLs are refused. The kit UI does not call this procedure.
				</li>
			</ul>
		</>
	);
}
