import type { LegalDocumentFrontmatter } from "../index";

export const frontmatter: LegalDocumentFrontmatter = {
	title: "Privacy Policy",
	updatedAt: "2026-04-26",
};

export default function PrivacyEn() {
	return (
		<>
			<p>
				<strong>Placeholder document.</strong> This is the English placeholder
				privacy policy shipped with the Fuutu Stack starter kit. Replace it with
				a document reviewed by qualified legal counsel before launching to real
				users.
			</p>

			<h2>1. Who we are</h2>
			<p>
				The data controller for this website is the operator named in our{" "}
				<a href="/legal/imprint">imprint</a>. You can reach us through the
				contact details listed there.
			</p>

			<h2>2. What data we process</h2>
			<ul>
				<li>
					<strong>Account data</strong> — email address, hashed password, name,
					organization membership.
				</li>
				<li>
					<strong>Usage data</strong> — anonymous, privacy-friendly analytics
					(only when you consent).
				</li>
				<li>
					<strong>Technical data</strong> — IP address, user agent, server logs
					(retained for security purposes).
				</li>
			</ul>

			<h2>3. Why we process it</h2>
			<ul>
				<li>To provide the service you signed up for (contractual basis).</li>
				<li>
					To improve the product and detect abuse (legitimate interest basis).
				</li>
				<li>
					To send service emails (transactional) and — only with consent —
					marketing emails.
				</li>
			</ul>

			<h2>4. Your rights</h2>
			<p>
				You have the right to access, rectify, export, and delete your personal
				data. You can withdraw consent at any time. Contact us via the addresses
				in our imprint to exercise these rights.
			</p>

			<h2>5. Cookies & tracking</h2>
			<p>
				We use only strictly necessary cookies by default. Optional analytics
				are loaded only after explicit consent.
			</p>

			<h2>6. Changes to this policy</h2>
			<p>
				We may update this policy from time to time. The "last updated" date at
				the top of this page reflects the most recent change.
			</p>
		</>
	);
}
