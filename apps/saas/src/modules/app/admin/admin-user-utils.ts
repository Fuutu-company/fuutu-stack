import { toSystemRole } from "@fuutu/rbac";

export function isAdminRole(role: string | null | undefined): boolean {
	return toSystemRole(role) === "admin";
}

export function initials(name: string | null | undefined, email: string) {
	const source = (name?.trim() || email).split(/[\s@.]+/).filter(Boolean);
	const letters = source
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");
	return letters || "?";
}
