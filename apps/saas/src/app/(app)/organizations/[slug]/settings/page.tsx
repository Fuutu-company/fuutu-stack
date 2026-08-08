import { redirect } from "next/navigation";

interface OrgSettingsPageProps {
	params: Promise<{ slug: string }>;
}

export default async function OrgSettingsPage({
	params,
}: OrgSettingsPageProps) {
	const { slug } = await params;
	redirect(`/organizations/${slug}/settings/general`);
}
