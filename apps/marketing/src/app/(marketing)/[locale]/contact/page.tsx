import { config } from "@fuutu/config";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

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

export default async function ContactPage({ params }: ContactPageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("contact");
	const { email, github, githubUrl } = config.app.contact;

	return (
		<div className="container mx-auto max-w-2xl px-4 py-16">
			<h1 className="mb-4 font-bold text-4xl tracking-tight">{t("title")}</h1>
			<p className="mb-8 text-lg text-muted-foreground">{t("description")}</p>
			<dl className="flex flex-col gap-4 text-sm">
				<div>
					<dt className="font-medium">{t("emailLabel")}</dt>
					<dd className="text-muted-foreground">
						<a href={`mailto:${email}`} className="hover:text-foreground">
							{email}
						</a>
					</dd>
				</div>
				<div>
					<dt className="font-medium">{t("githubLabel")}</dt>
					<dd className="text-muted-foreground">
						<a
							href={githubUrl}
							target="_blank"
							rel="noreferrer"
							className="hover:text-foreground"
						>
							{github}
						</a>
					</dd>
				</div>
			</dl>
		</div>
	);
}
