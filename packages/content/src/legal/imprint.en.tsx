import type { LegalDocumentFrontmatter } from "../index";

export const frontmatter: LegalDocumentFrontmatter = {
	title: "Imprint",
	updatedAt: "2026-04-26",
};

export default function ImprintEn() {
	return (
		<>
			<p>
				<strong>Placeholder document.</strong> Replace this imprint with your
				company's legally accurate information before launch. Some jurisdictions
				(notably Germany and Austria) impose strict requirements on what an
				imprint must contain.
			</p>

			<h2>Operator</h2>
			<p>
				Acme GmbH
				<br />
				Example Street 1<br />
				12345 Example City
				<br />
				Country
			</p>

			<h2>Contact</h2>
			<p>
				Email: <a href="mailto:hello@example.com">hello@example.com</a>
				<br />
				Phone: +00 000 0000000
			</p>

			<h2>Register entry</h2>
			<p>
				Commercial register: Local Court Example, HRB 000000
				<br />
				VAT ID: DE000000000
			</p>

			<h2>Responsible for content</h2>
			<p>Jane Doe (address as above)</p>

			<h2>Online dispute resolution</h2>
			<p>
				The European Commission provides a platform for online dispute
				resolution at{" "}
				<a
					href="https://ec.europa.eu/consumers/odr"
					target="_blank"
					rel="noreferrer"
				>
					ec.europa.eu/consumers/odr
				</a>
				. We are neither obligated nor willing to participate in dispute
				resolution proceedings before a consumer arbitration board.
			</p>
		</>
	);
}
