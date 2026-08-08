import { redirect } from "next/navigation";

interface OrgPageProps {
	params: Promise<{ slug: string }>;
}

export default async function OrganizationPage({ params }: OrgPageProps) {
	const { slug } = await params;
	redirect(`/organizations/${slug}/dashboard`);
}
