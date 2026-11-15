function metadataField(metadata: unknown, field: string): string | null {
	if (typeof metadata !== "object" || metadata === null) return null;
	const value = (metadata as Record<string, unknown>)[field];
	return typeof value === "string" && value !== "" ? value : null;
}

/** The support reason (`metadata.reason`) of an audit row, if it has one. */
export const auditReason = (metadata: unknown) =>
	metadataField(metadata, "reason");

/** The user a support action targeted (`metadata.targetUserId`). */
export const auditTargetUserId = (metadata: unknown) =>
	metadataField(metadata, "targetUserId");

/** The organization a support action targeted (`metadata.targetOrganizationId`). */
export const auditTargetOrganizationId = (metadata: unknown) =>
	metadataField(metadata, "targetOrganizationId");
