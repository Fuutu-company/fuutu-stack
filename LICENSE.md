# Fuutu Business License

**Version 1.0 — Effective 2026**

Copyright © 2026 Fuutu and the Fuutu Stack contributors. All rights reserved.

This license governs use of the accompanying software (the **"Software"**),
which includes — but is not limited to — the source code, configuration,
templates, schemas, documentation, build tooling and visual assets contained
in this repository (the **"Fuutu Stack"**).

This License is the **standard Fuutu Kit License**: it also applies, by
reference and in identical form, to every other starter kit, boilerplate
or template Fuutu publishes (e.g. the Fuutu Game-Engine Starter Kit, the
Fuutu Mobile Starter Kit, …). Each such product is a **"Fuutu Kit"**;
the specific repository you obtained is referred to throughout this
License simply as the **"Kit"**. References to "Fuutu Stack" in this
License are illustrative and bind the corresponding Kit you have
actually obtained.

By downloading, cloning, forking, installing, building, deploying or
otherwise using the Software you (the **"Licensee"**) accept the terms set
out below. If you do not agree, you must not use the Software.

---

## 1. Summary (non-binding)

The full terms in sections 2–14 are binding. This summary is provided for
convenience and does **not** override the binding text.

- **Three tiers.** OSS (free), **MCP Subscription** (paid monthly — adds
  access to the Fuutu MCP server and the versioning API), and
  **Enterprise License** (paid yearly — required above the Eligibility
  Thresholds, includes MCP). Current prices live at
  https://stack.fuutu.com/pricing.
- **Free for small teams.** You may use the Kit at no charge if you qualify
  as an *Eligible User* under section 3.
- **Paid for larger organisations.** Once you exceed the Eligibility
  Thresholds you must obtain a **Fuutu Enterprise License** under section 4.
- **No reselling as a competitor.** You may not redistribute the Kit, or a
  Derivative Work, as a competing starter-kit, boilerplate, template,
  scaffold, or generator — whether free or paid, whether under MIT or
  any other license (sections 6 and 6a).
- **Keep the fingerprint.** The `Fuutu-Stack` kit name, the kit version
  constant, the `X-Framework` HTTP response header and the build-time
  telemetry ping must remain functionally intact (section 7).
- **No warranty.** The Software is provided "AS IS" (section 12).

If anything in this summary appears to conflict with the binding text, the
binding text controls.

---

## 2. Definitions

- **"Kit"** — the Software as published in this repository, plus any
  official update, patch, fork, mirror or release artefact published by
  Fuutu.
- **"Derivative Work"** — any software that incorporates, embeds, adapts,
  translates, refactors, restyles or rebrands a substantial portion of the
  Kit (in source or compiled form), or that is created by running, scaffolding
  or templating from the Kit.
- **"Production Application"** — a software product, service, internal tool
  or website built using the Kit and made available to the Licensee, the
  Licensee's employees, or the Licensee's end-users.
- **"Annual Revenue"** — the total worldwide gross revenue, in any
  currency normalised to EUR using the European Central Bank reference
  rate, recognised by the Licensee and any entity controlling, controlled
  by or under common control with the Licensee, in the most recently
  completed fiscal year.
- **"Headcount"** — the total number of natural persons employed by, or
  acting as long-term contractor for (≥ 20 hours / week, ≥ 90 days), the
  Licensee and its affiliates, regardless of role.
- **"Eligibility Thresholds"** — Annual Revenue **≤ 250,000 EUR** *and*
  Headcount **≤ 10**.
- **"Fuutu"** — the legal entity publishing the Kit and holding the
  copyright and trademarks referenced in section 8.
- **"MCP Subscription"** — the recurring paid subscription described in
  section 4a, granting authenticated access to the Fuutu MCP server
  (mounted under `stackapp.fuutu.com/api/mcp/sse`) and to the Fuutu
  versioning API.
- **"Released Application"** — a Production Application (or any portion
  thereof) that the Licensee has published or made available to third
  parties under an open-source, source-available, public-domain or any
  other public license, regardless of the chosen license name.
- **"Substantial Kit Content"** — any combination of files, directories,
  configuration, schemas, build tooling, package skeletons or
  architectural patterns that, taken together, would allow a third party
  to recognise the result as a Fuutu Kit derivative and to use it as a
  starting point for a new application. The presence of the Kit
  fingerprint (section 7) is conclusive evidence; absence is not
  conclusive evidence to the contrary.

---

## 3. Free Use Grant (Eligible Users)

Subject to your continued compliance with this License, Fuutu grants you a
worldwide, non-exclusive, non-transferable, royalty-free license to use,
modify and run the Kit to build and operate Production Applications, **as
long as you stay within the Eligibility Thresholds** at all times.

You **lose** this free grant on the day you exceed either Eligibility
Threshold. From that day you must, within 30 calendar days, either:

1. obtain a **Fuutu Enterprise License** under section 4, **or**
2. cease all use of the Kit and remove all copies in your possession or
   control.

There is no obligation to publish, contribute, or open-source any
Derivative Work created under this section 3.

---

## 4a. MCP Subscription (optional, paid)

Independently of sections 3 and 4, the Licensee may purchase a recurring
**MCP Subscription** to obtain authenticated access to:

- the Fuutu MCP server (mounted under `stackapp.fuutu.com/api/mcp/sse`,
  read-only and mutating tools);
- the Fuutu versioning API (semantic-version inference from commit logs);
- such additional Fuutu-hosted developer services as Fuutu publishes from
  time to time at `https://stack.fuutu.com/pricing`.

The subscription is sold per natural-person subscriber. The current
price, subscription period and any volume terms are published at
`https://stack.fuutu.com/pricing` and form part of this License by
reference at the moment of purchase.

The MCP Subscription is **not** a license to the Kit itself: it does
not lift the Eligibility Thresholds in section 3, does not grant
additional rights under section 5, and does not waive any restriction in
section 6 or 6a. A subscriber who exceeds the Eligibility Thresholds
still requires a Fuutu Enterprise License under section 4.

A valid MCP Subscription is identified by an MCP API key issued by Fuutu;
the Kit reports `licenseMode = "mcp"` once a valid key is verified. The
Fuutu Enterprise License (section 4) **includes** MCP access at no
additional cost.

---

## 4. Fuutu Enterprise License

Use of the Kit by a Licensee that does not satisfy the Eligibility
Thresholds, or use that falls outside the scope of section 3, requires a
**Fuutu Enterprise License**.

The Fuutu Enterprise License is sold by Fuutu and entitles the holder to
the rights of section 3 plus enterprise terms (priority support, indemnity
options, license-key issuance, optional removal of telemetry).

The Fuutu Enterprise License is sold per legal entity. The current
price, subscription period and any volume terms are published at
**https://stack.fuutu.com/pricing** and form part of this License by
reference at the moment of purchase. Contact `license@fuutu.com` to
obtain a license key.

A valid Fuutu Enterprise License is identified by a license key issued by
Fuutu and configured via the `FUUTU_LICENSE_KEY` environment variable. The
Kit will report `licenseMode = "enterprise"` once a valid key is verified.

*Order of precedence between sections 4 and 4a:* a single key may grant
both Enterprise rights and MCP access; in that case the Kit reports
`licenseMode = "enterprise"` and MCP access is included as described
above.

---

## 5. Permitted Use

Subject to sections 3, 4, 6 and 7, the Licensee may:

- run the Kit to power Production Applications;
- create internal Derivative Works for the Licensee's own products and
  services;
- modify the source for the Licensee's own purposes;
- contribute back to the official upstream repository under the inbound =
  outbound contribution rule (section 11).

---

## 6. Restricted Use (no competing redistribution)

The Licensee **may not**, without a separate written commercial agreement
signed by Fuutu:

1. **Redistribute the Kit** — in source or compiled form, alone or as part
   of a Derivative Work — as a *starter kit*, *boilerplate*, *template*,
   *scaffold*, *generator*, *example app*, *course material*, *tutorial
   project* or any product whose primary purpose is to help third parties
   start a new application;
2. **Sell, sublicense or rent** the Kit, or substantial portions of it, to
   third parties as a stand-alone deliverable;
3. **Offer a managed or hosted version of the Kit** as a service whose
   primary purpose is to host or operate the Kit on behalf of third
   parties;
4. **Use Fuutu trademarks** to imply endorsement of, or affiliation with,
   any product not produced by Fuutu (see section 8);
5. **Disable, bypass, falsify or strip** the kit fingerprint, the
   `X-Framework` response header, the build-time telemetry ping, or the
   license-mode reporting (see section 7).

Building and selling a Production Application that *uses* the Kit is
expressly permitted under sections 3 and 4 and is **not** considered
competing redistribution under this section 6, provided the Kit itself is
not the product being sold.

---

## 6a. Released Applications and Open-Source Distribution

This section closes the open-source loophole created when a Licensee
publishes Kit-derived material under a permissive license (MIT, Apache-2.0,
BSD, MPL, the Unlicense, public domain, etc.). The Licensee acknowledges
that the right to relicense **does not** extend to Substantial Kit Content.

In relation to any Released Application:

1. **Licensee-authored code is unaffected.** The Licensee may publish
   the *application-specific* code of a Production Application — meaning
   the business logic, domain models, UI, content, branding and product
   features the Licensee authored on top of the Kit — under any license
   the Licensee chooses, including MIT, Apache-2.0 or any other
   open-source license.
2. **Substantial Kit Content remains under this License.** The Licensee
   **may not** include Substantial Kit Content in a Released Application
   under any license other than this License. Specifically, the Licensee
   **may not** publish:
   - the Kit's monorepo skeleton, package layout or `tooling/` config;
   - the Kit's authentication, billing, mail, telemetry, license,
     fingerprint or i18n packages, in original or refactored form;
   - the Kit's Prisma schema, route-group structure or middleware setup,
     when recognisable as a Fuutu Kit derivative;
   - any file containing, or any module re-exporting, a Kit fingerprint
     constant (section 7);
   - any "clean" or "stripped" version of the foregoing whose primary
     purpose is to be reused as a starter kit, boilerplate, template,
     scaffold or generator (this is competing redistribution under
     section 6 and is independently prohibited).
3. **License-text preservation.** Any Released Application that contains
   *any* portion of the Kit, however small, must preserve this License
   in a `LICENSE.md` (or equivalent) file in the root of the published
   work, and must preserve the kit fingerprint (section 7) intact.
4. **Notice obligation.** Before publishing a Released Application that
   contains Kit-derived material under any open-source license, the
   Licensee must notify `license@fuutu.com` with the public repository
   URL and a brief description of the released portions. This notice
   does not grant approval; it merely permits Fuutu to assess compliance
   with sections 6 and 6a. Failure to give notice is a breach.
5. **Mixed-license clarity.** Where a Released Application combines
   Licensee-authored code (e.g. MIT) with Kit-derived files governed by
   this License, each file must bear, or be covered by a manifest
   bearing, the license that actually governs it. The Licensee may not
   imply that the entire Released Application is MIT-licensed when it in
   fact contains Substantial Kit Content under this License.
6. **No license laundering.** A third party who receives Kit-derived
   material as part of a Released Application receives **no** rights
   under this License beyond those they would have obtained directly
   from Fuutu. The Licensee may not use a permissive sublicense to
   confer Kit usage rights on third parties who would otherwise require
   their own license under section 3 or 4.

If a Licensee makes Substantial Kit Content available under a permissive
open-source license in violation of this section, that grant is **void
from inception** with respect to the Kit-derived portion: third parties
relying on the void grant remain bound by this License from the moment
they become aware (or should reasonably have become aware) of the
violation, irrespective of the public license tag attached to the
repository.

---

## 7. Kit Fingerprint and Telemetry

The Kit emits two integrity signals that must remain functional:

1. **Kit fingerprint** — the constants `KIT_NAME` and `KIT_VERSION`
   exported from `@fuutu/config`, plus the `X-Framework:
   Fuutu-Stack/<version>` HTTP response header set on every API and
   page response.
2. **Build-time telemetry ping** — a single, non-blocking HTTPS request
   sent at build time, transmitting:
   - a one-way hash of the configured license key (or `"oss"` if none),
   - the configured public application URL,
   - the Node.js runtime version,
   - the Kit version,
   - a flat list of enabled top-level feature names (no user data, no PII).

The ping has a 5-second timeout, fails silently on network error, and can
be disabled by setting `FUUTU_TELEMETRY_DISABLED=1`. Disabling telemetry
is permitted; **falsifying** telemetry (sending data that misrepresents
the Kit identity, the license mode or the deploying entity) is **not** and
constitutes a material breach of this License.

The privacy notice for the telemetry endpoint is published at
`https://fuutu.com/legal/telemetry`.

---

## 8. Trademarks

"Fuutu", "Fuutu Stack", the Fuutu logo and any associated word- or
device-marks (the **"Marks"**) are trademarks of Fuutu. This License does
**not** grant you any right to use the Marks except for descriptive,
non-misleading factual references such as "Built with Fuutu Stack". You
must not use the Marks in product names, logos, domain names, package
names or marketing materials of Derivative Works or competing products.

---

## 9. Third-Party Components

The Kit bundles or depends on third-party open-source software, each
covered by its own license (typically MIT, Apache-2.0, ISC, BSD-3-Clause).
Those licenses are unmodified and continue to apply to their respective
components. This License governs only the Fuutu-authored portions of the
Kit and the combined work as distributed by Fuutu.

---

## 10. Intellectual Property

All right, title and interest in the Kit, including all copyrights,
patents, trade secrets and trademarks, remain with Fuutu and its
contributors. No rights are granted by implication, estoppel or otherwise
beyond those expressly stated in this License.

---

## 11. Contributions

Contributions submitted to the official Fuutu Stack repository are
licensed to Fuutu under the **inbound = outbound** rule: by submitting a
contribution you grant Fuutu and downstream Licensees the same rights
under this License that you received in the contributed material, plus a
perpetual, worldwide, royalty-free patent license to the extent necessary
to make, use, sell and distribute the contribution as part of the Kit.

---

## 12. No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. THE ENTIRE
RISK ARISING OUT OF THE USE OR PERFORMANCE OF THE SOFTWARE REMAINS WITH
THE LICENSEE.

## 13. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
FUUTU, ITS AFFILIATES OR CONTRIBUTORS BE LIABLE FOR ANY INDIRECT,
INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR FOR
LOSS OF PROFITS, REVENUE, DATA OR USE, ARISING OUT OF OR RELATED TO THIS
LICENSE OR THE USE OF THE SOFTWARE, EVEN IF FUUTU HAS BEEN ADVISED OF THE
POSSIBILITY OF SUCH DAMAGES. THE AGGREGATE LIABILITY OF FUUTU UNDER THIS
LICENSE SHALL NOT EXCEED THE FEES PAID BY THE LICENSEE TO FUUTU IN THE
TWELVE (12) MONTHS PRECEDING THE CLAIM, OR ONE THOUSAND EUROS (EUR 1,000)
IF NO FEES WERE PAID. For the avoidance of doubt, fees paid for an MCP
Subscription (section 4a) count toward this cap only with respect to
claims arising from the MCP services themselves; they do not increase
the cap for claims arising from use of the Kit under sections 3 or 4.

---

## 14. Termination, Governing Law, Severability

This License terminates automatically upon any material breach by the
Licensee. Sections 6, 6a, 7, 8, 10, 12 and 13 survive termination.

This License is governed by the laws of the **Federal Republic of
Germany**, excluding its conflict-of-laws rules. Exclusive venue for any
dispute is the competent court at the registered seat of Fuutu, except
where the Licensee is a consumer protected by mandatory law.

If any provision of this License is held unenforceable, the remaining
provisions remain in full force and effect, and the unenforceable
provision shall be replaced by an enforceable provision that most closely
matches the original intent.

---

## Contact

- Licensing & enterprise inquiries: `license@fuutu.com`
- Security disclosures: `security@fuutu.com`
- General: `hello@fuutu.com`
- Pricing: `https://stack.fuutu.com/pricing`
