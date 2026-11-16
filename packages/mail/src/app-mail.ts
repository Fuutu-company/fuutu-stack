import type { AppMail } from "./types";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Extensions for the transactional email templates (contract: `AppMail`
 * in `./types.ts`):
 *
 * - `legalFooter`: company details under every email — a string, a list
 *   of lines, or a function of the recipient locale. Rendered small below
 *   the email card and at the end of the plain-text part; the mail
 *   preview app (`pnpm -F @fuutu/mail-preview dev`) shows it.
 *
 * ```ts
 * export const appMail: AppMail = {
 *   legalFooter: [
 *     "Acme GmbH · Musterstraße 1 · 10115 Berlin",
 *     "Amtsgericht Berlin-Charlottenburg, HRB 123456 · Geschäftsführer: Erika Mustermann",
 *   ],
 * };
 * ```
 */
export const appMail: AppMail = {};
