import { getPost } from "@fuutu/content";
import { ImageResponse } from "next/og";

export const alt = "Fuutu Stack — Blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgImageProps {
	params: Promise<{ locale: string; slug: string }>;
}

export default async function BlogOgImage({ params }: OgImageProps) {
	const { slug } = await params;
	const post = getPost(slug);
	const title = post?.frontmatter.title ?? "Fuutu Stack";
	const description = post?.frontmatter.description ?? "";

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				padding: "72px",
				background: "linear-gradient(135deg, #0b1020 0%, #1e1b4b 100%)",
				color: "white",
				fontFamily: "sans-serif",
			}}
		>
			<div
				style={{
					fontSize: 28,
					letterSpacing: "0.08em",
					textTransform: "uppercase",
					color: "#a5b4fc",
					display: "flex",
				}}
			>
				Fuutu Stack · Blog
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
						fontWeight: 700,
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
							color: "#cbd5e1",
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
