import { describe, expect, it } from "vitest";
import {
	anonymousMaxMajor,
	evaluateDesktopAccess,
	maxLicensedMajor,
} from "../access";
import type { DesktopFeatureId } from "../config";

const DAY = 86_400_000;
const now = new Date("2026-11-21T12:00:00Z");
const base = {
	requiredFeature: null as DesktopFeatureId | null,
	perMajorVersion: true,
	majors: {} as Partial<Record<number, DesktopFeatureId>>,
	trialDays: null as number | null,
	deviceLimit: 3 as number | null,
};

describe("evaluateDesktopAccess", () => {
	it("grants every account when no feature is required", () => {
		const access = evaluateDesktopAccess({
			...base,
			features: [],
			userCreatedAt: now,
			deviceCount: 1,
			now,
		});
		expect(access).toEqual({
			status: "granted",
			trialEndsAt: null,
			maxLicensedMajor: null,
		});
	});

	it("needs the required feature", () => {
		const input = {
			...base,
			requiredFeature: "api_webhooks" as const,
			userCreatedAt: new Date(now.getTime() - 90 * DAY),
			deviceCount: 1,
			now,
		};
		expect(evaluateDesktopAccess({ ...input, features: [] }).status).toBe(
			"missing",
		);
		expect(
			evaluateDesktopAccess({ ...input, features: ["api_webhooks"] }).status,
		).toBe("granted");
	});

	it("gives a trial from sign-up without the feature", () => {
		const input = {
			...base,
			requiredFeature: "api_webhooks" as const,
			trialDays: 14,
			features: [],
			deviceCount: 1,
			now,
		};
		const fresh = evaluateDesktopAccess({
			...input,
			userCreatedAt: new Date(now.getTime() - 3 * DAY),
		});
		expect(fresh.status).toBe("trial");
		expect(fresh.trialEndsAt?.toISOString()).toBe(
			new Date(now.getTime() + 11 * DAY).toISOString(),
		);
		const old = evaluateDesktopAccess({
			...input,
			userCreatedAt: new Date(now.getTime() - 30 * DAY),
		});
		expect(old.status).toBe("missing");
	});

	it("reports the device limit once exceeded", () => {
		const input = { ...base, features: [], userCreatedAt: now, now };
		expect(evaluateDesktopAccess({ ...input, deviceCount: 3 }).status).toBe(
			"granted",
		);
		expect(evaluateDesktopAccess({ ...input, deviceCount: 4 }).status).toBe(
			"device_limit",
		);
		expect(
			evaluateDesktopAccess({ ...input, deviceLimit: null, deviceCount: 99 })
				.status,
		).toBe("granted");
	});
});

describe("maxLicensedMajor", () => {
	it("is unbounded without per-major licensing or a major map", () => {
		expect(maxLicensedMajor({ ...base, perMajorVersion: false }, [])).toBe(
			null,
		);
		expect(maxLicensedMajor(base, [])).toBe(null);
	});

	it("caps below the first major whose feature is missing", () => {
		const config = {
			...base,
			majors: {
				2: "api_webhooks",
				3: "auth_sso",
			} as Partial<Record<number, DesktopFeatureId>>,
		};
		expect(maxLicensedMajor(config, [])).toBe(1);
		expect(maxLicensedMajor(config, ["api_webhooks"])).toBe(2);
		expect(maxLicensedMajor(config, ["api_webhooks", "auth_sso"])).toBe(null);
	});
});

describe("anonymousMaxMajor", () => {
	it("is the highest major no listed feature guards", () => {
		expect(
			anonymousMaxMajor({
				perMajorVersion: true,
				majors: { 2: "api_webhooks" },
			}),
		).toBe(1);
		expect(
			anonymousMaxMajor({
				perMajorVersion: true,
				majors: { 1: "api_webhooks" },
			}),
		).toBe(0);
		expect(anonymousMaxMajor({ perMajorVersion: true, majors: {} })).toBeNull();
		expect(
			anonymousMaxMajor({
				perMajorVersion: false,
				majors: { 2: "api_webhooks" },
			}),
		).toBeNull();
	});
});
