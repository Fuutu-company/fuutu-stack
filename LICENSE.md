# Fuutu Business License

**Version 1.3**

Copyright © 2026 Fuutu UG (haftungsbeschränkt) and the Fuutu Stack contributors. All rights reserved.

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

- **Three tiers.** **Free** (no charge, for Eligible Users); **Fuutu Pro**
  (previously named "MCP Plus"; a subscription per Seat, billed yearly;
  adds authenticated access to the Fuutu MCP server's rules and skills
  and to the versioning API; the public documentation tools are free);
  and **Fuutu Enterprise License** (a yearly subscription per legal
  entity, required above the Eligibility Thresholds, includes Pro for
  five Seats). Pro and Enterprise are independent subscriptions, each
  with its own renewal date. Prices are in USD, net of VAT, and published
  at https://fuutustack.com/pricing.
- **Free for small teams.** You may use the Kit at no charge if you qualify
  as an *Eligible User* under section 3.
- **Paid for larger organisations.** Once you exceed the Eligibility
  Thresholds you must obtain a **Fuutu Enterprise License** under section 4.
- **Enterprise ends.** You may keep using the Kit versions released up to
  the last day of your last paid Enterprise term, but not newer ones
  (section 4(5)).
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
- **Warranty and liability.** The free grant is provided "AS IS". For
  paid licenses, the Fuutu Terms of Service govern warranty and
  liability (sections 12 and 13).

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
- **"Fuutu"** — Fuutu UG (haftungsbeschränkt), Jaegersstr. 15, 41462
  Neuss, Germany, registered with the Amtsgericht Neuss under HRB 24870,
  the publisher of the Kit and holder of the copyright in its
  Fuutu-authored portions.
- **"Terms of Service"** — the Fuutu Terms of Service published at
  https://fuutustack.com/legal/terms, as accepted with a paid
  subscription.
- **"Pro"** or **"Fuutu Pro"** (previously named "MCP Plus") — the
  recurring paid subscription per Seat described in section 4a.
- **"Seat"** — the Pro access of one natural person, either as part of a
  Pro subscription or as one of the five Seats included in an Enterprise
  License.
- **"Covered Versions"** — the Kit versions defined in section 4(5).
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

If you are an Eligible User, you **lose** this free grant on the day you
exceed either Eligibility Threshold. From that day you must, within 30
calendar days, either:

1. obtain a **Fuutu Enterprise License** under section 4, **or**
2. cease all use of the Kit and remove all copies in your possession or
   control.

This 30-day period does not apply to a former Enterprise licensee whose
Enterprise License has ended; section 4(5) governs that case.

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
   example, a three-person studio earning USD 500 a month that builds and
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

## 4. Fuutu Enterprise License

1. **When it is needed.** Use of the Kit by a Licensee that does not
   satisfy the Eligibility Thresholds, or use that falls outside the scope
   of section 3, requires a **Fuutu Enterprise License**.

2. **What it includes.** The Fuutu Enterprise License is licensed by
   Fuutu and sold through Fuutu's reseller (merchant of record) as stated
   on the pricing page. It entitles the holder, for the term of the
   subscription, to the rights of section 3 regardless of the Eligibility
   Thresholds, to private support by email, to license-key issuance, and
   to Pro for five Seats as described in section 4a. No response time or
   service level is promised unless agreed in text form.

3. **Per legal entity.** The Fuutu Enterprise License is granted per
   legal entity. Each legal entity that operates a Production Application
   or otherwise uses the Kit needs its own Enterprise License if its
   Annual Revenue or Headcount, together with its Affiliates, exceeds an
   Eligibility Threshold. It is billed yearly in advance and includes
   five Seats; additional Seats cost the Pro price. The price,
   subscription period and any volume terms are those published at
   **https://fuutustack.com/pricing** at the moment of purchase or
   renewal, subject to the Terms of Service. This License sets no price.

4. **License keys.** A valid Fuutu Enterprise License is identified by a
   license key issued by Fuutu and configured via the `FUUTU_LICENSE_KEY`
   environment variable. License keys are issued in the Fuutu account;
   contact `license@fuutustack.com` for help. The Kit reports
   `licenseMode = "enterprise"` once a valid Enterprise key is verified.
   Enterprise Licenses and Pro subscriptions are identified by separate
   keys. Where only a valid Pro key is verified, the Kit reports
   `licenseMode = "pro"`.

5. **End of an Enterprise License.** If an Enterprise License ends or is
   paused for any reason other than a termination for the Licensee's
   breach (section 14), the Licensee may continue to use, modify and run,
   without time limit and regardless of the Eligibility Thresholds, the
   Kit versions released on or before the last day of its last paid term
   (**"Covered Versions"**), within the scope of this section 4. Using,
   installing or merging a later Kit version requires a valid Enterprise
   License, unless the Licensee is then an Eligible User under section 3.
   Updates, license-key verification, support and the included Seats
   end. The Licensee keeps its license key configured in installations
   that use Covered Versions, so that the telemetry under section 7
   identifies them.

---

## 4a. Fuutu Pro (optional, paid)

Independently of sections 3 and 4, the Licensee may purchase a recurring
**Fuutu Pro** subscription (previously named "MCP Plus") to obtain
authenticated access to:

- the Fuutu MCP server (mounted under `app.fuutustack.com/api/mcp`),
  including its rules and skills tools;
- the Fuutu versioning API (semantic-version inference from commit logs);
- such additional Fuutu-hosted developer services as Fuutu publishes from
  time to time at `https://fuutustack.com/pricing`.

Pro is sold per Seat: one Seat gives one natural person Pro access. The
price, subscription period and any volume terms are those published at
`https://fuutustack.com/pricing` at the moment of purchase or renewal,
subject to the Terms of Service. This License sets no price.

Prices published at `https://fuutustack.com/pricing` are in USD, are net
prices and exclude value-added tax and similar taxes, which are added
where applicable. Subscriptions are billed yearly in advance.

Pro is **not** a license to the Kit itself: it does not lift the
Eligibility Thresholds in section 3, does not grant additional rights
under section 5, and does not waive any restriction in section 6 or 6a.
A subscriber who exceeds the Eligibility Thresholds still requires a
Fuutu Enterprise License under section 4.

The public documentation tools of the Fuutu MCP server (documentation
search and pages, changelog, update check) may be used without a key,
subject to fair-use rate limits. They are provided as-is and Fuutu may
change, limit or discontinue them at any time.

A valid Pro subscription is identified by an API key issued by Fuutu; the
Kit reports `licenseMode = "pro"` once a valid Pro key is verified.

A Fuutu Enterprise License (section 4) includes Pro for five persons
(five Seats) for as long as the Enterprise License is active. Additional
persons need Seats of a Pro subscription. Pro subscriptions and
Enterprise Licenses are independent subscriptions: each is purchased,
renewed and cancelled separately and has its own renewal date. A
cancelled subscription ends at the end of the paid term. Included Seats
end with the Enterprise License. The holder assigns its included Seats to
persons in its Fuutu account. If both a valid Enterprise key and a valid
Pro key are present, the Enterprise key takes precedence.

---

## 5. Permitted Use

Subject to sections 3, 4, 6 and 7, the Licensee may:

- run the Kit to power Production Applications;
- create internal Derivative Works for the Licensee's own products and
  services;
- modify the source for the Licensee's own purposes;
- contribute back to the official upstream repository under the
  contribution terms of section 11.

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
4. **Use the Fuutu names or logo** to imply endorsement of, or
   affiliation with, any product not produced by Fuutu (see section 8);
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

**Purpose of the version data.** Fuutu uses the reported Kit version per
license-key hash to verify that installations use only the Kit versions
they are licensed for, including Covered Versions under section 4(5).
Telemetry never triggers an automated action; a person at Fuutu contacts
the Licensee first.

**Switching telemetry off.** Setting `FUUTU_TELEMETRY_DISABLED=1` switches
the ping off. This is permitted only for local development and for
non-production instances, such as development, staging, CI and preview
environments. A Production Application in use must keep telemetry
enabled.

Removing, patching, blocking or stripping the telemetry code or the Kit
fingerprint is never permitted. **Falsifying** telemetry (sending data
that misrepresents the Kit identity, the Kit version, the license mode or
the deploying entity) constitutes a material breach of this License.

The privacy notice for the telemetry endpoint is published at
`https://fuutustack.com/legal/telemetry`.

---

## 8. Names and Logo

This License grants no right to use the names "Fuutu" and "Fuutu Stack"
or the Fuutu logo, except for descriptive, non-misleading factual
references such as "Built with Fuutu Stack". You must not use them in
product names, logos, domain names, package names or marketing materials
of Derivative Works or competing products, or in a way that implies
endorsement by or affiliation with Fuutu.

---

## 9. Third-Party Components

The Kit bundles or depends on third-party open-source software, each
covered by its own license (typically MIT, Apache-2.0, ISC, BSD-3-Clause).
Those licenses are unmodified and continue to apply to their respective
components. This License governs only the Fuutu-authored portions of the
Kit and the combined work as distributed by Fuutu.

---

## 10. Intellectual Property

All right, title and interest in the Kit, including all copyrights and
other intellectual property rights, remain with Fuutu and its
contributors. No rights are granted by implication, estoppel or otherwise
beyond those expressly stated in this License.

---

## 11. Contributions

1. **Contribution terms.** Contributions to the official Fuutu Stack
   repository (code, documentation, assets and any other material
   submitted, for example in a pull request) are accepted only under the
   contribution terms in `CONTRIBUTING.md` of that repository as in force
   when the contribution is submitted. Unless those terms say otherwise,
   items 2 to 5 apply.
2. **License of the contribution.** You license your contribution to
   everyone, free of charge, under the MIT No Attribution License
   (MIT-0, https://spdx.org/licenses/MIT-0.html). You also grant Fuutu
   and every recipient of the Kit a perpetual, worldwide, non-exclusive,
   royalty-free and irrevocable license under the patent claims you can
   license that are necessarily infringed by the contribution alone or by
   its combination with the Kit, to make, have made, use, sell, offer
   for sale, import and otherwise distribute the contribution, alone or as
   part of the Kit.
3. **Origin.** You certify each contribution under the Developer
   Certificate of Origin 1.1 (https://developercertificate.org) by a
   `Signed-off-by` line in each commit. You confirm that you have the
   right to submit the contribution under these terms, including the
   consent of your employer where needed.
4. **Distribution by Fuutu.** Fuutu may distribute contributions as part
   of the Kit under this License, any later version of it, or separate
   commercial terms. Your authorship stays visible in the history of the
   repository; no other attribution is owed.
5. **No obligations, no payment.** Fuutu need not accept, use, keep or
   credit a contribution. Contributions are voluntary and unpaid. They
   create no employment, service, agency or partnership relationship and
   no claim to payment, credit or other consideration.

---

## 12. No Warranty (free grant)

Where the Software is used under the free grant of section 3, THE SOFTWARE
IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. THE ENTIRE RISK
ARISING OUT OF THE USE OR PERFORMANCE OF THE SOFTWARE REMAINS WITH THE
LICENSEE. Statutory liability for fraudulently concealed defects remains
unaffected.

For paid licenses (sections 4 and 4a), warranty is governed by the Terms
of Service.

## 13. Liability

Nothing in this License limits liability for intent, gross negligence,
injury to life, body or health, under the German Product Liability Act
(Produkthaftungsgesetz), for fraudulently concealed defects or under a
guarantee.

Where Fuutu provides the Software free of charge, Fuutu is liable only in
these cases.

For paid licenses, the liability provisions of the Terms of Service
(section 20) apply, including the cap at the fees paid for the most recent
12-month subscription period.

---

## 14. Termination, License Versions, Governing Law, Severability

**Termination.** Fuutu may terminate this License for a material breach
by the Licensee that is not cured within 30 days after notice in text
form. Termination is immediate where a cure is impossible or the breach is
a falsification under section 7. Continued use of a Kit version that is
not a Covered Version (section 4(5)) after such notice is a material
breach. Sections 6, 6a, 7, 8, 10, 12 and 13 survive termination. Section
4(5) does not survive a termination for breach.

**License versions.** The license text distributed with a Kit version
governs the use of that version. Later changes to this License apply only
to Kit versions released after the change: a Licensee who stays on an
older Kit version keeps the terms shipped with it. Once a Licensee merges
or installs a newer Kit version, the license text shipped with that
version applies from then on. The current text is published at
https://github.com/Fuutu-company/fuutu-stack/blob/main/LICENSE.md, and
the text for a specific Kit release at
https://github.com/Fuutu-company/fuutu-stack/blob/kit-v<version>/LICENSE.md.

**Governing law and venue.** This License is governed by the laws of the
**Federal Republic of Germany**, excluding its conflict-of-laws rules and
the UN Convention on Contracts for the International Sale of Goods
(CISG). If the Licensee is a merchant (Kaufmann), a legal entity under
public law or a special fund under public law, or has no general place of
jurisdiction in Germany, the exclusive place of jurisdiction is **Neuss,
Germany**. Fuutu may also sue at the Licensee's general place of
jurisdiction.

**Severability.** If any provision of this License is held unenforceable,
the remaining provisions remain in full force and effect. The statutory
provisions apply in place of the unenforceable provision.

---

## Contact

- Licensing & enterprise inquiries: `license@fuutustack.com`
- Security disclosures: `security@fuutustack.com`
- General: `hello@fuutustack.com`
- Pricing: `https://fuutustack.com/pricing`
