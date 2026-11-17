import { slugify } from "@fuutu/utils";

/**
 * Storage key for a new org logo upload: the slugged file name plus a
 * random suffix, so a logo key cannot be guessed or claimed in advance.
 */
export function orgLogoKey(fileName: string): string {
	return `${slugify(fileName) || "logo"}-${crypto.randomUUID()}`;
}
