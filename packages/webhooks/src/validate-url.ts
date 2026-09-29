import { lookup } from "node:dns/promises";
import { env } from "@fuutu/env/saas";

export type WebhookUrlValidation = {
	valid: boolean;
	reason?: string;
};

export type ResolveHost = (hostname: string) => Promise<string[]>;

const defaultResolveHost: ResolveHost = async (hostname) => {
	const results = await lookup(hostname, { all: true, verbatim: true });
	return results.map((r) => r.address);
};

type Hextets = [number, number, number, number, number, number, number, number];

/**
 * Expand an IPv6 address (possibly compressed with `::`) into 8 hextets.
 * Returns null for non-IPv6 input.
 */
function expandIPv6(host: string): Hextets | null {
	if (!host.includes(":")) return null;
	const v4Suffix = host.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
	let hextets: number[] = [];
	let tailV4: number[] | null = null;
	let body = host;
	const v4Match = v4Suffix?.[1];
	if (v4Match) {
		tailV4 = v4Match.split(".").map(Number);
		body = host.slice(0, host.length - v4Match.length - 1);
	}
	const halves = body.split("::");
	if (halves.length > 2) return null;
	const parseHalf = (s: string) =>
		s === "" ? [] : s.split(":").map((h) => Number.parseInt(h, 16));
	const head = parseHalf(halves[0] ?? "");
	const tail = halves.length === 2 ? parseHalf(halves[1] ?? "") : [];
	if ([...head, ...tail].some((h) => Number.isNaN(h) || h < 0 || h > 0xffff)) {
		return null;
	}
	const tailLen = tail.length + (tailV4 ? 2 : 0);
	const fill = 8 - head.length - tailLen;
	if (fill < 0) return null;
	hextets = [...head, ...new Array<number>(fill).fill(0), ...tail];
	if (
		tailV4?.[0] !== undefined &&
		tailV4[1] !== undefined &&
		tailV4[2] !== undefined &&
		tailV4[3] !== undefined
	) {
		hextets.push((tailV4[0] << 8) | tailV4[1], (tailV4[2] << 8) | tailV4[3]);
	}
	if (hextets.length !== 8) return null;
	return hextets as Hextets;
}

/**
 * Normalize an IPv4-mapped/embedded IPv6 to its embedded IPv4 dotted-decimal
 * string so the IPv4 blocklist applies. Returns null when not embedded.
 */
function embeddedIPv4(h: Hextets): string | null {
	// ::ffff:a.b.c.d — IPv4-mapped IPv6
	if (h[5] === 0xffff && h.slice(0, 5).every((x) => x === 0)) {
		return hextetPairToIPv4(h[6], h[7]);
	}
	// 64:ff9b::/96 — NAT64, embeds the IPv4 in the last 32 bits
	if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) {
		return hextetPairToIPv4(h[6], h[7]);
	}
	// 2002::/16 — 6to4, embeds the IPv4 in bits 16–47
	if (h[0] === 0x2002) {
		return hextetPairToIPv4(h[1], h[2]);
	}
	return null;
}

function hextetPairToIPv4(hi: number, lo: number): string {
	return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isBlockedIPv4(host: string): boolean {
	const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (!match) return false;
	const [a, b, c] = [Number(match[1]), Number(match[2]), Number(match[3])];
	if (a === 0) return true; // 0.0.0.0/8 "this host"
	if (a === 10) return true; // 10.0.0.0/8 private
	if (a === 127) return true; // 127.0.0.0/8 loopback
	if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
	if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
	if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
	if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
	if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF assignments
	if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
	if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmark
	if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
	if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
	if (a >= 224 && a <= 239) return true; // 224.0.0.0/4 multicast
	if (a >= 240) return true; // 240.0.0.0/4 reserved
	return false;
}

function isBlockedIPv6(host: string): boolean {
	const h = expandIPv6(host);
	if (!h) return false;
	const embedded = embeddedIPv4(h);
	if (embedded) return isBlockedIPv4(embedded);
	if (h.every((x) => x === 0)) return true; // ::/128 unspecified
	if (h[7] === 1 && h.slice(0, 7).every((x) => x === 0)) return true; // ::1
	if (h[0] >= 0xfc00 && h[0] <= 0xfdff) return true; // fc00::/7 unique-local
	if (h[0] >= 0xfe80 && h[0] <= 0xfeff) return true; // fe80::/9 link-local + fec0::/10 site-local
	if (h[0] === 0x2001 && h[1] === 0x0db8) return true; // 2001:db8::/32 documentation
	return false;
}

/**
 * Validate a webhook endpoint URL to prevent SSRF.
 *
 * Production (`NODE_ENV !== "development"`): HTTPS only. The hostname —
 * whether an IP literal or a DNS name — must not resolve to any
 * private/reserved address. Every resolved IP is checked (a DNS name like
 * `169.254.169.254.nip.io` can map a public-looking host to an internal IP).
 *
 * Development: `http:` is allowed and private/loopback ranges are NOT blocked
 * so localhost receivers (`http://localhost:3000/hook`, Docker service names,
 * LAN IPs) work for local testing. Never relax this in production.
 *
 * Callers: webhook registration procedures (fail-fast for the user) and the
 * delivery worker (fail-safe at send time, right before `fetch`).
 */
export async function validateWebhookUrl(
	url: string,
	resolveHost: ResolveHost = defaultResolveHost,
): Promise<WebhookUrlValidation> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { valid: false, reason: "malformed URL" };
	}

	const isDev = env.NODE_ENV === "development";
	if (!isDev && parsed.protocol !== "https:") {
		return { valid: false, reason: "must use HTTPS in production" };
	}
	if (isDev && parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		return { valid: false, reason: "must use HTTP or HTTPS" };
	}

	// Dev mode intentionally skips IP-range checks: local receivers
	// (localhost, LAN, Docker networks) are legitimate targets there.
	if (isDev) {
		return { valid: true };
	}

	// Normalize hostname: strip IPv6 brackets. Node's URL parser already
	// canonicalizes IPv6 (e.g. [::ffff:127.0.0.1] → [::ffff:7f00:1]).
	const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();

	// IP literals — no DNS needed.
	if (isBlockedIPv4(host) || isBlockedIPv6(host)) {
		return { valid: false, reason: "private/reserved IP range blocked" };
	}
	const isIpLiteral = /^[\d.]+$/.test(host) || expandIPv6(host) !== null;
	if (isIpLiteral) {
		return { valid: true };
	}

	// DNS names: resolve and require EVERY address to be public. This covers
	// wildcard DNS services (nip.io, sslip.io) and multi-record rebinding.
	let addresses: string[];
	try {
		addresses = await resolveHost(host);
	} catch {
		return { valid: false, reason: "hostname could not be resolved" };
	}
	for (const address of addresses) {
		const normalized = address.replace(/^\[|\]$/g, "").toLowerCase();
		if (isBlockedIPv4(normalized) || isBlockedIPv6(normalized)) {
			return { valid: false, reason: "private/reserved IP range blocked" };
		}
	}

	return { valid: true };
}
