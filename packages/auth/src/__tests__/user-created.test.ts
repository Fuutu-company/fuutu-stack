import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitUserCreatedOnFirstMembership } from "../hooks/user-created";

const claimUserCreatedEvent = vi.fn();
const resetUserCreatedEvent = vi.fn();
const dispatchEvent = vi.fn();

vi.mock("@fuutu/db", () => ({
	claimUserCreatedEvent: (...args: unknown[]) => claimUserCreatedEvent(...args),
	resetUserCreatedEvent: (...args: unknown[]) => resetUserCreatedEvent(...args),
}));

vi.mock("@fuutu/webhooks", () => ({
	dispatchEvent: (...args: unknown[]) => dispatchEvent(...args),
}));

describe("emitUserCreatedOnFirstMembership()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		claimUserCreatedEvent.mockResolvedValue(true);
		resetUserCreatedEvent.mockResolvedValue(undefined);
		dispatchEvent.mockResolvedValue(undefined);
	});

	it("claims the flag and dispatches user.created scoped to the org", async () => {
		await emitUserCreatedOnFirstMembership("user-1", "org-1");

		expect(claimUserCreatedEvent).toHaveBeenCalledWith("user-1");
		expect(dispatchEvent).toHaveBeenCalledTimes(1);
		expect(dispatchEvent).toHaveBeenCalledWith({
			event: "user.created",
			organizationId: "org-1",
			payload: { userId: "user-1", organizationId: "org-1" },
		});
	});

	it("skips dispatch when the claim fails (already sent)", async () => {
		claimUserCreatedEvent.mockResolvedValue(false);

		await emitUserCreatedOnFirstMembership("user-1", "org-1");

		expect(dispatchEvent).not.toHaveBeenCalled();
	});

	it("does not dispatch twice across calls (claim wins exactly once)", async () => {
		claimUserCreatedEvent
			.mockResolvedValueOnce(true)
			.mockResolvedValueOnce(false);

		await emitUserCreatedOnFirstMembership("user-1", "org-1");
		await emitUserCreatedOnFirstMembership("user-1", "org-1");

		expect(dispatchEvent).toHaveBeenCalledTimes(1);
		expect(resetUserCreatedEvent).not.toHaveBeenCalled();
	});

	it("resets the flag when dispatch fails so a later membership retries", async () => {
		dispatchEvent
			.mockRejectedValueOnce(new Error("webhook down"))
			.mockResolvedValueOnce(undefined);

		await emitUserCreatedOnFirstMembership("user-1", "org-1");
		await emitUserCreatedOnFirstMembership("user-1", "org-1");

		expect(resetUserCreatedEvent).toHaveBeenCalledWith("user-1");
		expect(dispatchEvent).toHaveBeenCalledTimes(2);
	});

	it("never throws when dispatch fails", async () => {
		dispatchEvent.mockRejectedValue(new Error("webhook down"));

		await expect(
			emitUserCreatedOnFirstMembership("user-1", "org-1"),
		).resolves.toBeUndefined();
	});

	it("never throws when the flag reset fails too", async () => {
		dispatchEvent.mockRejectedValue(new Error("webhook down"));
		resetUserCreatedEvent.mockRejectedValue(new Error("db down"));

		await expect(
			emitUserCreatedOnFirstMembership("user-1", "org-1"),
		).resolves.toBeUndefined();
	});

	it("never throws when the claim query fails", async () => {
		claimUserCreatedEvent.mockRejectedValue(new Error("db down"));

		await expect(
			emitUserCreatedOnFirstMembership("user-1", "org-1"),
		).resolves.toBeUndefined();
	});

	it("does not reset the flag when the claim itself fails", async () => {
		claimUserCreatedEvent.mockRejectedValue(new Error("db down"));

		await emitUserCreatedOnFirstMembership("user-1", "org-1");

		expect(resetUserCreatedEvent).not.toHaveBeenCalled();
	});
});
