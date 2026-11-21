import type { DesktopSession } from "@fuutu/desktop/session";
import { describe, expect, it } from "vitest";
import {
	DesktopAuthError,
	decideAccess,
	isForbiddenSwitch,
	majorOf,
	type SessionState,
} from "../auth";

function online(access: Partial<DesktopSession["access"]>): SessionState {
	return {
		state: "online",
		session: {
			access: {
				status: "granted",
				trialEndsAt: null,
				maxLicensedMajor: null,
				...access,
			},
		} as DesktopSession,
	};
}

const offline = (maxMajor: number | null): SessionState => ({
	state: "offline",
	session: null,
	claim: { sub: "u1", org: null, access: "granted", maxMajor, exp: 2e9 },
});

describe("decideAccess", () => {
	it("never blocks with auth optional or off", () => {
		expect(decideAccess("optional", { state: "signed_out" }, "1.0.0")).toEqual({
			kind: "open",
		});
		expect(decideAccess("off", undefined, "1.0.0")).toEqual({ kind: "open" });
	});

	it("asks for a sign-in when required and signed out", () => {
		expect(
			decideAccess("required", { state: "signed_out" }, "1.0.0").kind,
		).toBe("sign_in");
	});

	it("follows desktop.session access", () => {
		expect(decideAccess("required", online({}), "1.0.0").kind).toBe("granted");
		expect(
			decideAccess("required", online({ status: "missing" }), "1.0.0").kind,
		).toBe("missing");
		expect(
			decideAccess("required", online({ status: "device_limit" }), "1.0.0")
				.kind,
		).toBe("device_limit");
		expect(
			decideAccess(
				"required",
				online({ status: "trial", trialEndsAt: "2030-01-01T00:00:00.000Z" }),
				"1.0.0",
			),
		).toEqual({
			kind: "granted",
			trialEndsAt: "2030-01-01T00:00:00.000Z",
			offline: false,
		});
	});

	it("blocks a major version above the licence — online and offline", () => {
		expect(
			decideAccess("required", online({ maxLicensedMajor: 1 }), "2.0.0"),
		).toEqual({
			kind: "upgrade",
			licensedMajor: 1,
		});
		expect(
			decideAccess("required", online({ maxLicensedMajor: 2 }), "2.3.0").kind,
		).toBe("granted");
		expect(decideAccess("required", offline(1), "2.0.0").kind).toBe("upgrade");
		expect(decideAccess("required", offline(null), "2.0.0")).toEqual({
			kind: "granted",
			trialEndsAt: null,
			offline: true,
		});
	});

	it("blocks when unreachable without offline grace", () => {
		expect(
			decideAccess(
				"required",
				{ state: "unreachable", reason: "expired" },
				"1.0.0",
			).kind,
		).toBe("unreachable");
	});
});

describe("majorOf", () => {
	it("reads the semver major", () => {
		expect(majorOf("2.4.1")).toBe(2);
		expect(majorOf("0.0.0")).toBe(0);
		expect(majorOf("garbage")).toBe(0);
	});
});

describe("isForbiddenSwitch", () => {
	it("matches only a refused organization switch", () => {
		expect(
			isForbiddenSwitch(
				new DesktopAuthError("rejected", "desktop.session: 403 Forbidden"),
			),
		).toBe(true);
		expect(
			isForbiddenSwitch(
				new DesktopAuthError(
					"rejected",
					"desktop.session: 429 Too Many Requests",
				),
			),
		).toBe(false);
		expect(isForbiddenSwitch(new DesktopAuthError("network", "403"))).toBe(
			false,
		);
	});
});
