import { APIError } from "better-auth/api";
import { signJWT } from "better-auth/crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserByEmail = vi.fn();
const sendEmail = vi.fn();

vi.mock("@fuutu/db", () => ({
	getUserByEmail: (...args: unknown[]) => getUserByEmail(...args),
}));
vi.mock("../lib/email", () => ({
	sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

const { notifyPreviousEmailAfterChange } = await import(
	"../hooks/email-change-notice"
);

const SECRET = "test-secret-test-secret-test-secret-12";

const changeToken = (
	secret = SECRET,
	requestType = "change-email-verification",
) =>
	signJWT(
		{ email: "old@fuutu.dev", updateTo: "new@fuutu.dev", requestType },
		secret,
		3600,
	);

const redirectTo = (location: string) =>
	new APIError("FOUND", undefined, new Headers({ location }));

beforeEach(() => {
	vi.clearAllMocks();
	getUserByEmail.mockResolvedValue({
		email: "new@fuutu.dev",
		name: "Ada",
		locale: "de",
	});
	sendEmail.mockResolvedValue(undefined);
});

describe("notifyPreviousEmailAfterChange", () => {
	it("tells the previous address once the change went through", async () => {
		await notifyPreviousEmailAfterChange({
			path: "/verify-email",
			token: await changeToken(),
			returned: redirectTo("/auth/verify-email-change?email=new%40fuutu.dev"),
			secret: SECRET,
		});
		expect(getUserByEmail).toHaveBeenCalledWith("new@fuutu.dev");
		expect(sendEmail).toHaveBeenCalledWith({
			to: "old@fuutu.dev",
			template: "email-changed",
			data: { name: "Ada", newEmail: "new@fuutu.dev", locale: "de" },
		});
	});

	it("also handles the JSON answer (no callbackURL)", async () => {
		await notifyPreviousEmailAfterChange({
			path: "/verify-email",
			token: await changeToken(),
			returned: { status: true, user: { email: "new@fuutu.dev" } },
			secret: SECRET,
		});
		expect(sendEmail).toHaveBeenCalledTimes(1);
	});

	it.each([
		["a failed verification", redirectTo("/settings?error=USER_NOT_FOUND")],
		["an error answer", new APIError("UNAUTHORIZED")],
	])("sends nothing after %s", async (_label, returned) => {
		await notifyPreviousEmailAfterChange({
			path: "/verify-email",
			token: await changeToken(),
			returned,
			secret: SECRET,
		});
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("sends nothing for a forged token (wrong secret)", async () => {
		await notifyPreviousEmailAfterChange({
			path: "/verify-email",
			token: await changeToken("another-secret-another-secret-12345"),
			returned: { status: true },
			secret: SECRET,
		});
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("sends nothing for the confirmation step (the new address is not verified yet)", async () => {
		await notifyPreviousEmailAfterChange({
			path: "/verify-email",
			token: await changeToken(SECRET, "change-email-confirmation"),
			returned: { status: true },
			secret: SECRET,
		});
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("sends nothing when no account holds the new address", async () => {
		getUserByEmail.mockResolvedValue(null);
		await notifyPreviousEmailAfterChange({
			path: "/verify-email",
			token: await changeToken(),
			returned: { status: true },
			secret: SECRET,
		});
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("never throws when the mail fails (the change already happened)", async () => {
		sendEmail.mockRejectedValue(new Error("provider down"));
		await expect(
			notifyPreviousEmailAfterChange({
				path: "/verify-email",
				token: await changeToken(),
				returned: { status: true },
				secret: SECRET,
			}),
		).resolves.toBeUndefined();
	});

	it("ignores other paths", async () => {
		await notifyPreviousEmailAfterChange({
			path: "/sign-in/email",
			token: await changeToken(),
			returned: { status: true },
			secret: SECRET,
		});
		expect(getUserByEmail).not.toHaveBeenCalled();
	});
});
