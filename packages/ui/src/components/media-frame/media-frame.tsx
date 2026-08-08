import { cn } from "../../lib/utils";
import { ExpandableWrapper } from "./expandable";
import { FrameChrome } from "./frame-chrome";
import { FrameContent } from "./frame-content";
import { FrameIphone } from "./frame-iphone";
import type { MediaFrameProps } from "./types";

/**
 * Flexible media frame — placeholder, image, video, iframe, or custom children.
 *
 * @example
 * // Placeholder with macOS chrome
 * <MediaFrame chrome variant="primary" label="Dashboard" size="1280 × 720" />
 *
 * // Lazy image, no chrome
 * <MediaFrame imageSrc="/shots/dashboard.webp" imageAlt="Dashboard" width={900} />
 *
 * // YouTube embed with chrome
 * <MediaFrame chrome videoSrc="https://youtu.be/abc123" />
 *
 * // Live website in iPhone frame
 * <MediaFrame iphone iframeSrc="https://example.com" width={320} />
 *
 * // Custom content, no chrome
 * <MediaFrame width="100%"><MyDemo /></MediaFrame>
 */
export function MediaFrame({
	chrome = false,
	iphone = false,
	variant = "default",
	imageSrc,
	imageAlt,
	videoSrc,
	iframeSrc,
	showUrl = true,
	autoPlay = false,
	hoverPlay = false,
	label,
	size,
	sizePosition,
	filename,
	width,
	height,
	contentClassName,
	children,
	className,
	expandable = false,
	expandLabel,
}: MediaFrameProps) {
	const autoFilename =
		filename ??
		(imageSrc
			? (imageSrc.split("/").pop() ?? "app.localhost")
			: videoSrc
				? "video.embed"
				: iframeSrc
					? iframeSrc.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
					: "app.localhost");

	let frameContent: React.ReactNode;

	if (iphone) {
		frameContent = (
			<FrameIphone
				variant={variant}
				imageSrc={imageSrc}
				imageAlt={imageAlt}
				videoSrc={videoSrc}
				iframeSrc={iframeSrc}
				showUrl={showUrl}
				autoPlay={autoPlay}
				hoverPlay={hoverPlay}
				label={label}
				size={size}
				sizePosition={sizePosition}
				contentClassName={contentClassName}
				width={width}
				className={className}
				autoFilename={autoFilename}
			>
				{children}
			</FrameIphone>
		);
	} else if (chrome) {
		frameContent = (
			<FrameChrome
				variant={variant}
				imageSrc={imageSrc}
				imageAlt={imageAlt}
				videoSrc={videoSrc}
				iframeSrc={iframeSrc}
				showUrl={showUrl}
				autoPlay={autoPlay}
				hoverPlay={hoverPlay}
				label={label}
				size={size}
				sizePosition={sizePosition}
				height={height}
				contentClassName={contentClassName}
				width={width}
				className={className}
				autoFilename={autoFilename}
			>
				{children}
			</FrameChrome>
		);
	} else {
		frameContent = (
			<div
				style={width ? { width } : undefined}
				className={cn("overflow-visible", className)}
			>
				<FrameContent
					variant={variant}
					imageSrc={imageSrc}
					imageAlt={imageAlt}
					videoSrc={videoSrc}
					iframeSrc={iframeSrc}
					showUrl={showUrl}
					autoPlay={autoPlay}
					hoverPlay={hoverPlay}
					label={label}
					size={size}
					sizePosition={sizePosition}
					height={height}
					contentClassName={contentClassName}
					rounded="rounded-2xl"
				>
					{children}
				</FrameContent>
			</div>
		);
	}

	if (expandable) {
		return (
			<ExpandableWrapper ariaLabel={expandLabel}>
				{frameContent}
			</ExpandableWrapper>
		);
	}

	return frameContent;
}

/** @deprecated Use `<MediaFrame chrome />` instead. */
export const MacFrame = (props: Omit<MediaFrameProps, "chrome">) => (
	<MediaFrame {...props} chrome />
);
