import { config } from "@fuutu/config";
import { Card } from "@fuutu/ui";
import { PageIntro } from "@shared/components/page-intro";
import { ArrowUpRight, GitBranch, Mail } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

interface ContactPageProps {
	params: Promise<{ locale: string }>;
}

export async function generateMetadata({
	params,
}: ContactPageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "contact" });
	return { title: t("title"), description: t("description") };
}

function ContactCard({
	icon,
	label,
	value,
	href,
	external,
}: {
	icon: ReactNode;
	label: string;
	value: string;
	href: string;
	external?: boolean;
}) {
	return (
		<Card className="relative flex-row items-center gap-4 px-6 py-5 transition-shadow duration-150 focus-within:shadow-md hover:shadow-md motion-reduce:transition-none">
			<span
				aria-hidden="true"
				className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground [&>svg]:size-5"
			>
				{icon}
			</span>
			<div className="min-w-0">
				<h2 className="font-bold font-heading text-base">{label}</h2>
				<a
					href={href}
					{...(external ? { target: "_blank", rel: "noreferrer" } : {})}
					className="mt-0.5 inline-flex max-w-full items-center gap-1 break-all text-muted-foreground underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-2xl hover:text-foreground hover:underline focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
				>
					{value}
					{external ? (
						<ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
					) : null}
				</a>
			</div>
		</Card>
	);
}

export default async function ContactPage({ params }: ContactPageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("contact");
	const { email, github, githubUrl } = config.app.contact;

	return (
		<div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 md:pt-20">
			<PageIntro title={t("title")} description={t("description")} />
			<div className="mt-12 grid gap-4">
				<ContactCard
					icon={<Mail />}
					label={t("emailLabel")}
					value={email}
					href={`mailto:${email}`}
				/>
				<ContactCard
					icon={<GitBranch />}
					label={t("githubLabel")}
					value={github}
					href={githubUrl}
					external
				/>
			</div>
		</div>
	);
}
