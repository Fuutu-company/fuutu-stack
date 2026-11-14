# Fuutu Business License

**Version 1.1 — Effective 2026**

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

- **Three tiers.** OSS (free); **MCP Plus** (a yearly subscription per
  Seat; adds authenticated access to the Fuutu MCP server's rules and
  skills and to the versioning API; the public documentation tools are
  free); and **Enterprise License** (a yearly subscription per legal
  entity, required above the Eligibility Thresholds, includes MCP Plus
  for five persons). MCP Plus and Enterprise are independent
  subscriptions, each with its own renewal date. Prices are net of VAT
  and are published at https://fuutustack.com/pricing.
- **Free for small teams.** You may use the Kit at no charge if you qualify
  as an *Eligible User* under section 3.
- **Paid for larger organisations.** Once you exceed the Eligibility
  Thresholds you must obtain a **Fuutu Enterprise License** under section 4.
- **Agencies and client work.** Whoever operates an application needs a
  license for it. Building or running an application for a client that
  exceeds the Eligibility Thresholds requires an Enterprise License,
  even for a small agency (section 3a).
- **No reselling as a competitor.** You may not redistribute the Kit, or a
  Derivative Work, as a competing starter-kit, boilerplate, template,
  scaffold, or generator — whether free or paid, whether under MIT or
  any other license (sections 6 and 6a).
- **Keep the fingerprint.** The `Fuutu-Stack` kit name, the kit version
  constant, the `X-Framework` HTTP response header and the telemetry
  ping must remain functionally intact. Telemetry carries license data
  only and may be switched off only on local development and
  non-production instances (section 7).
- **Per version.** Each Kit version is governed by the license text
  shipped with it (section 14).
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
  or website built using the Kit and made available to the Operator, its
  employees or its end users.
- **"Operator"** — the legal entity that controls the production
  environment of a Production Application. It holds the hosting or
  infrastructure account or contract, or decides on deployment, and it
  makes the application available to users.
  - Performing technical administration for another entity as a
    contractor does not make a person or entity the Operator.
  - End users and customers of a Production Application are not
    Operators.
- **"Client"** — a third party for which a Licensee develops or maintains
  a Production Application under contract.
- **"Affiliate"** — any entity that controls, is controlled by, or is
  under common control with the Licensee. "Control" means owning more
  than 50% of the voting rights, or the power to direct management.
- **"Annual Revenue"** — the total worldwide gross revenue, in any
  currency normalised to USD using the European Central Bank reference
  rate, recognised by the Licensee and its Affiliates in the most
  recently completed fiscal year.
- **"Headcount"** — the total number of natural persons employed by, or
  acting as long-term contractor for (≥ 20 hours / week, ≥ 90 days), the
  Licensee and its Affiliates, regardless of role.
- **"Eligibility Thresholds"** — Annual Revenue **≤ 250,000 USD** *and*
  Headcount **≤ 10**.
- **"Eligible User"** — a Licensee within the Eligibility Thresholds.
- **"Fuutu"** — the legal entity publishing the Kit and holding the
  copyright and trademarks referenced in section 8.
- **"MCP Plus"** — the recurring paid subscription described in
  section 4a, granting authenticated access to the Fuutu MCP server
  (mounted under `app.fuutustack.com/api/mcp`) and to the Fuutu
  versioning API.
- **"Seat"** — the MCP Plus access of one natural person, either as an
  MCP Plus subscription or as one of the persons included in an
  Enterprise License.
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

## 3a. Agencies and Client Work

1. **Operators need a license.** The Operator of a Production Application
   needs a license under this License for it: the free grant under
   section 3, or a Fuutu Enterprise License under section 4. The
   Eligibility Thresholds are assessed for the Operator together with its
   Affiliates.
2. **Development and maintenance for a Client.** A Licensee that develops
   or maintains a Production Application for a Client that is its
   Operator uses the Kit for that work under its own license (section 3
   or 4). The Client, as the Operator, needs its own license under item 1:
   the free grant if it is an Eligible User, otherwise a Fuutu Enterprise
   License.
3. **Agency-operated applications.** If a Licensee develops a Production
   Application for a Client and remains its Operator (it hosts and runs
   the application), the Licensee's license covers that application, and
   the Client needs no license of its own to use it. Item 4 applies on
   top.
4. **Large Clients.** A Licensee that builds, hosts or offers a
   Production Application for a Client that, together with its
   Affiliates, exceeds an Eligibility Threshold needs its own Fuutu
   Enterprise License, even if the Licensee itself is within the
   Eligibility Thresholds. This applies under items 2 and 3 alike. For
   example, a three-person studio earning €500 a month that builds and
   hosts a service for a multinational corporation needs an Enterprise
   License.
5. **Handover.** If the Licensee hands over a Production Application,
   including Kit-derived source code, to a Client and the Client becomes
   its Operator:
   (a) the Client receives its rights directly from Fuutu under this
   License. The Licensee grants no sublicense;
   (b) license keys are personal to the entity they were issued to and
   are not transferable. The Licensee must remove its keys from the
   handed-over application;
   (c) the Client needs a valid license under section 3 or 4 from the
   moment it becomes the Operator. The 30-day period of section 3 applies
   only if the Client was an Eligible User at that moment and later
   exceeds a threshold;
   (d) sections 6, 6a and 7 bind the Client;
   (e) the Licensee must inform the Client about this License before or
   at handover.
6. **Limits.** This section 3a does not permit:
   (a) delivering the same application, or a template derived from it,
   to several Clients as a reusable product. That is competing
   redistribution under section 6(1);
   (b) hosting whose subject is the Kit itself or a generic deployment of
   the Kit for third parties. That remains prohibited under section 6(3).

   Within these limits, handing over a Client's own Production
   Application is not redistribution, sale or sublicensing under
   section 6(1) or 6(2), and hosting and running it for the Client is not
   a managed or hosted version of the Kit under section 6(3).

---

## 4a. MCP Plus (optional, paid)

Independently of sections 3 and 4, the Licensee may purchase a recurring
**MCP Plus** subscription to obtain authenticated access to:

- the Fuutu MCP server (mounted under `app.fuutustack.com/api/mcp`),
  including its rules and skills tools;
- the Fuutu versioning API (semantic-version inference from commit logs);
- such additional Fuutu-hosted developer services as Fuutu publishes from
  time to time at `https://fuutustack.com/pricing`.

The subscription is sold per Seat: one subscription gives one natural
person MCP Plus access. The current price, subscription period and any
volume terms are published at `https://fuutustack.com/pricing` and form
part of this License by reference at the moment of purchase.

Prices published at `https://fuutustack.com/pricing` are net prices and
exclude value-added tax and similar taxes, which are added where
applicable. Subscriptions are billed yearly in advance.

MCP Plus is **not** a license to the Kit itself: it does
not lift the Eligibility Thresholds in section 3, does not grant
additional rights under section 5, and does not waive any restriction in
section 6 or 6a. A subscriber who exceeds the Eligibility Thresholds
still requires a Fuutu Enterprise License under section 4.

The public documentation tools of the Fuutu MCP server (documentation
search and pages, changelog, update check) may be used without a key,
subject to fair-use rate limits. They are provided as-is and Fuutu may
change, limit or discontinue them at any time.

A valid MCP Plus subscription is identified by an MCP API key issued by Fuutu;
the Kit reports `licenseMode = "mcp"` once a valid key is verified.

A Fuutu Enterprise License (section 4) includes MCP Plus access for five
persons (five Seats) for as long as the Enterprise License is active.
Additional persons need their own MCP Plus subscriptions (Seats). MCP
Plus subscriptions and Enterprise Licenses are independent
subscriptions: each is purchased, renewed and cancelled separately and
has its own renewal date. A cancelled subscription ends at the end of
the paid term. Included Seats end with the Enterprise License. The holder
assigns its included Seats to persons in its Fuutu account. If both a
valid Enterprise key and a valid MCP Plus key are present, the
Enterprise key takes precedence.

---

## 4. Fuutu Enterprise License

Use of the Kit by a Licensee that does not satisfy the Eligibility
Thresholds, or use that falls outside the scope of section 3, requires a
**Fuutu Enterprise License**.

The Fuutu Enterprise License is sold by Fuutu and entitles the holder to
the rights of section 3 regardless of the Eligibility Thresholds,
prioritized private support, license-key issuance, and MCP Plus access
for five persons as described in section 4a.

The Fuutu Enterprise License is granted per legal entity. Each legal
entity that operates a Production Application or otherwise uses the Kit
needs its own Enterprise License if its Annual Revenue and Headcount,
together with its Affiliates, exceed an Eligibility Threshold. The
current price, subscription period and any volume terms are published at
**https://fuutustack.com/pricing** and form part of this License by
reference at the moment of purchase. Contact `license@fuutustack.com` to
obtain a license key.

A valid Fuutu Enterprise License is identified by a license key issued by
Fuutu and configured via the `FUUTU_LICENSE_KEY` environment variable. The
Kit will report `licenseMode = "enterprise"` once a valid key is verified.

*Keys and license modes:* Enterprise Licenses and MCP Plus subscriptions
are identified by separate keys. Where a valid Enterprise key is
verified, the Kit reports `licenseMode = "enterprise"`; where only a
valid MCP Plus key is verified, it reports `licenseMode = "mcp"`.

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
5. **Remove, patch, block, bypass, falsify or strip** the kit
   fingerprint, the `X-Framework` response header, the telemetry ping or
   the license-mode reporting, or switch the telemetry ping off for a
   Production Application in use. Switching it off is permitted only as
   described in section 7.

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
   Licensee must notify `license@fuutustack.com` with the public repository
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
2. **Telemetry ping** — non-blocking, fail-soft HTTPS requests sent
   at build time, at each API process start, and hourly once the
   built-in cron trigger is configured and enabled. Its only purpose is
   license compliance. Each ping transmits exactly these fields:
   - `kitName`: the Kit name,
   - `kitVersion`: the Kit version,
   - `licenseKeyHash`: a one-way hash of the configured license key, or
     `"oss"` if none is configured,
   - `appUrl`: the configured public application URL, or `null` if none,
   - `kind`: `"build"` for the build-time ping, `"runtime"` for pings
     from a running application.

   The ping contains no data of your application's end users; the
   license-key hash and application URL identify the Licensee's
   installation.

The ping has a 5-second timeout and fails silently on network error.

**Switching telemetry off.** Setting `FUUTU_TELEMETRY_DISABLED=1` switches
the ping off. This is permitted only for local development and for
non-production instances, such as development, staging, CI and preview
environments. A Production Application in use must keep telemetry
enabled.

Removing, patching, blocking or stripping the telemetry code or the Kit
fingerprint is never permitted. **Falsifying** telemetry (sending data
that misrepresents the Kit identity, the license mode or the deploying
entity) constitutes a material breach of this License.

The privacy notice for the telemetry endpoint is published at
`https://fuutustack.com/legal/telemetry`.

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
Plus (section 4a) count toward this cap only with respect to
claims arising from the MCP services themselves; they do not increase
the cap for claims arising from use of the Kit under sections 3 or 4.

---

## 14. Termination, License Versions, Governing Law, Severability

This License terminates automatically upon any material breach by the
Licensee. Sections 6, 6a, 7, 8, 10, 12 and 13 survive termination.

**License versions.** The license text distributed with a Kit version
governs the use of that version. Later changes to this License apply only
to Kit versions released after the change: a Licensee who stays on an
older Kit version keeps the terms shipped with it. Once a Licensee merges
or installs a newer Kit version, the license text shipped with that
version applies from then on.

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

- Licensing & enterprise inquiries: `license@fuutustack.com`
- Security disclosures: `security@fuutustack.com`
- General: `hello@fuutustack.com`
- Pricing: `https://fuutustack.com/pricing`
