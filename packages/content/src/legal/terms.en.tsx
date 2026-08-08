import type { LegalDocumentFrontmatter } from "../index";

export const frontmatter: LegalDocumentFrontmatter = {
	title: "Terms of Service",
	updatedAt: "2026-04-26",
};

export default function TermsEn() {
	return (
		<>
			<p>
				<strong>Placeholder document.</strong> These are placeholder terms of
				service shipped with the Fuutu Stack starter kit. Replace them with a
				document reviewed by qualified legal counsel before accepting real users
				or payments.
			</p>

			<h2>1. Acceptance</h2>
			<p>
				By creating an account or using the service you agree to these terms. If
				you do not agree, please do not use the service.
			</p>

			<h2>2. The service</h2>
			<p>
				We provide a software-as-a-service platform. We may add, change, or
				remove features at our discretion to improve the product, with
				reasonable notice for material changes.
			</p>

			<h2>3. Your account</h2>
			<ul>
				<li>You are responsible for keeping your credentials secure.</li>
				<li>
					You must be of legal age in your jurisdiction to enter into contracts.
				</li>
				<li>
					One person or legal entity may not maintain multiple free accounts.
				</li>
			</ul>

			<h2>4. Acceptable use</h2>
			<p>
				You agree not to misuse the service — no illegal content, no
				infringement of third-party rights, no attempts to disrupt or
				reverse-engineer the platform, no unsolicited bulk messaging.
			</p>

			<h2>5. Subscriptions & payments</h2>
			<p>
				Paid plans are billed in advance via our payment processor. Cancel any
				time from your billing settings — your plan stays active until the end
				of the billing period.
			</p>

			<h2>6. Termination</h2>
			<p>
				We may suspend or terminate accounts that violate these terms. You may
				delete your account at any time from settings.
			</p>

			<h2>7. Liability</h2>
			<p>
				To the maximum extent permitted by law, the service is provided "as is".
				We are not liable for indirect or consequential damages.
			</p>

			<h2>8. Governing law</h2>
			<p>
				These terms are governed by the laws of the operator's jurisdiction (see
				imprint), without regard to conflict-of-laws principles.
			</p>
		</>
	);
}
