import { config } from "@fuutu/config";
import { getPost } from "@fuutu/content";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgImageProps {
	params: Promise<{ locale: string; slug: string }>;
}

export async function generateImageMetadata({ params }: OgImageProps) {
	const { locale, slug } = await params;
	// Build-time collection calls this once with empty params; the real
	// per-post call happens at request time.
	if (!slug) return [];
	const t = await getTranslations({ locale, namespace: "blog" });
	return [{ id: slug, alt: `${config.app.name} — ${t("title")}` }];
}

// Colors mirror the light tokens in packages/config/brand.css (OG images need
// literal values): background, foreground, muted-foreground, area-users.
export default async function BlogOgImage({ params }: OgImageProps) {
	const { locale, slug } = await params;
	const t = await getTranslations({ locale, namespace: "blog" });
	const post = getPost(slug);
	// Drafts must not leak through OG tags — same gate as the page route.
	const visiblePost = post && !post.frontmatter.draft ? post : null;
	const title = visiblePost?.frontmatter.title ?? config.app.name;
	const description = visiblePost?.frontmatter.description ?? "";

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				padding: "72px",
				background: "#f0f4f7",
				color: "#151b24",
				fontFamily: "sans-serif",
			}}
		>
			<div style={{ display: "flex" }}>
				<div
					style={{
						fontSize: 28,
						fontWeight: 600,
						color: "#0d4768",
						background: "#b6e6ff",
						borderRadius: 999,
						padding: "10px 28px",
						display: "flex",
					}}
				>
					{config.app.name} · {t("title")}
				</div>
			</div>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 24,
				}}
			>
				<div
					style={{
						fontSize: 72,
						fontWeight: 800,
						lineHeight: 1.05,
						letterSpacing: "-0.02em",
						display: "flex",
					}}
				>
					{title}
				</div>
				{description ? (
					<div
						style={{
							fontSize: 32,
							color: "#545b66",
							lineHeight: 1.3,
							display: "flex",
						}}
					>
						{description.length > 160
							? `${description.slice(0, 157)}…`
							: description}
					</div>
				) : null}
			</div>
		</div>,
		{ ...size },
	);
}
