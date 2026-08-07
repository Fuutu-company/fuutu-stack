import { db } from "../client";

export type ContactCreateInput = {
	organizationId: string;
	name: string;
	email: string;
	company?: string | null;
	phone?: string | null;
	status?: string;
	notes?: string | null;
};

export type ContactUpdateInput = {
	name?: string;
	email?: string;
	company?: string | null;
	phone?: string | null;
	status?: string;
	notes?: string | null;
};

export type ContactListOptions = {
	take?: number;
	skip?: number;
	status?: string;
	search?: string;
};

export type ContactCountOptions = {
	status?: string;
	search?: string;
};

export const createContact = (data: ContactCreateInput) =>
	db.contact.create({
		data: {
			organizationId: data.organizationId,
			name: data.name,
			email: data.email,
			company: data.company ?? null,
			phone: data.phone ?? null,
			status: data.status ?? "lead",
			notes: data.notes ?? null,
		},
	});

export const listContacts = (
	organizationId: string,
	opts: ContactListOptions = {},
) => {
	const { take = 50, skip = 0, status, search } = opts;
	return db.contact.findMany({
		where: {
			organizationId,
			...(status ? { status } : {}),
			...(search
				? {
						OR: [
							{ name: { contains: search, mode: "insensitive" } },
							{ email: { contains: search, mode: "insensitive" } },
							{ company: { contains: search, mode: "insensitive" } },
						],
					}
				: {}),
		},
		orderBy: { createdAt: "desc" },
		take,
		skip,
	});
};

export const getContact = (id: string, organizationId: string) =>
	db.contact.findFirst({ where: { id, organizationId } });

export const updateContact = async (
	id: string,
	organizationId: string,
	data: ContactUpdateInput,
) => {
	const owned = await db.contact.findFirst({
		where: { id, organizationId },
	});
	if (!owned) return null;
	return db.contact.update({
		where: { id },
		data,
	});
};

export const deleteContact = async (id: string, organizationId: string) => {
	const owned = await db.contact.findFirst({
		where: { id, organizationId },
	});
	if (!owned) return null;
	return db.contact.delete({ where: { id } });
};

export const countContacts = (
	organizationId: string,
	opts: ContactCountOptions = {},
) => {
	const { status, search } = opts;
	return db.contact.count({
		where: {
			organizationId,
			...(status ? { status } : {}),
			...(search
				? {
						OR: [
							{ name: { contains: search, mode: "insensitive" } },
							{ email: { contains: search, mode: "insensitive" } },
							{ company: { contains: search, mode: "insensitive" } },
						],
					}
				: {}),
		},
	});
};
