import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdatePaymentsCustomerId = vi.fn();
vi.mock("@fuutu/db", () => ({
	updatePaymentsCustomerId: mockUpdatePaymentsCustomerId,
}));

const mockWarn = vi.fn();
vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: mockWarn,
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

const mockCreateCustomer = vi.fn();
const mocks = vi.hoisted(() => ({
	provider: {
		id: "test-provider",
		createCustomer: vi.fn(),
	},
}));

vi.mock("../resolve", () => ({
	resolvePaymentProvider: () => mocks.provider,
}));

const { createCustomerForUser } = await import("../customers");

describe("createCustomerForUser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.provider = {
			id: "test-provider",
			createCustomer: mockCreateCustomer,
		};
	});

	it("creates a provider customer and stores the returned id", async () => {
		mockCreateCustomer.mockResolvedValue({ customerId: "cust_123" });

		await createCustomerForUser({
			id: "user_1",
			email: "u@test.com",
			name: "Test User",
		});

		expect(mockCreateCustomer).toHaveBeenCalledWith({
			userId: "user_1",
			email: "u@test.com",
			name: "Test User",
		});
		expect(mockUpdatePaymentsCustomerId).toHaveBeenCalledWith(
			"user_1",
			"cust_123",
		);
	});

	it("does not propagate provider failures — signup is best-effort", async () => {
		mockCreateCustomer.mockRejectedValue(new Error("provider down"));

		await expect(
			createCustomerForUser({ id: "user_1", email: "u@test.com" }),
		).resolves.toBeUndefined();

		expect(mockUpdatePaymentsCustomerId).not.toHaveBeenCalled();
		expect(mockWarn).toHaveBeenCalled();
	});

	it("does not propagate DB failures — signup is best-effort", async () => {
		mockCreateCustomer.mockResolvedValue({ customerId: "cust_123" });
		mockUpdatePaymentsCustomerId.mockRejectedValue(new Error("db down"));

		await expect(
			createCustomerForUser({ id: "user_1", email: "u@test.com" }),
		).resolves.toBeUndefined();
	});
});
