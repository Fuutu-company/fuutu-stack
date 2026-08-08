import { vi } from "vitest";

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			listOrganizations: vi.fn(),
			getFullOrganization: vi.fn(),
			createOrganization: vi.fn(),
			updateOrganization: vi.fn(),
			deleteOrganization: vi.fn(),
			createInvitation: vi.fn(),
			updateMemberRole: vi.fn(),
			removeMember: vi.fn(),
			listInvitations: vi.fn(),
			cancelInvitation: vi.fn(),
			getSession: vi.fn(),
		},
	},
}));

vi.mock("@fuutu/db", () => ({
	db: {},
	prismaAuditSink: vi.fn(),
	listAuditLogs: vi.fn(),
	notificationExists: vi.fn(),
	setOnboardingComplete: vi.fn(),
}));
