import { cn } from "../../lib/utils";
import { FramePlaceholder } from "./frame-placeholder";
import type { InternalContentProps } from "./types";
import { toDisplayHost, toSafeIframeUrl, toYouTubeEmbed } from "./utils";
import { VideoPlayer } from "./video";

export function FrameContent({
	variant = "default",
	imageSrc,
	imageAlt = "",
	videoSrc,
	iframeSrc,
	showUrl = true,
	autoPlay = false,
	hoverPlay = false,
	label,
	size,
	sizePosition,
	height,
	contentClassName,
	children,
	rounded = "rounded-2xl",
	roundedStyle,
	filename,
	iphoneFill = false,
	playLabel,
	pauseLabel,
	videoTitle,
}: InternalContentProps) {
	const embedUrl = videoSrc ? toYouTubeEmbed(videoSrc) : null;
	const safeIframeSrc = iframeSrc ? toSafeIframeUrl(iframeSrc) : null;
	const isVideo = Boolean(videoSrc);
	const contentStyle = height ? { height } : undefined;
	const fillClass = iphoneFill ? "absolute inset-0 size-full" : "";
	const rs = roundedStyle ? { borderRadius: roundedStyle } : undefined;

	if (children) {
		return (
			<div
				className={cn("overflow-hidden", rounded, fillClass, contentClassName)}
				style={rs}
			>
				{children}
			</div>
		);
	}

	if (safeIframeSrc) {
		return (
			<div
				className={cn(
					"relative overflow-hidden",
					rounded,
					iphoneFill ? "absolute inset-0 size-full" : !height && "aspect-video",
					contentClassName,
				)}
				style={iphoneFill ? rs : { ...contentStyle, ...rs }}
			>
				{/* Sandboxed embed (no allow-same-origin → opaque origin). New domains
				    also need a frame-src CSP entry in each app's next.config.ts. */}
				<iframe
					src={safeIframeSrc}
					title={filename ?? safeIframeSrc}
					className="absolute inset-0 size-full border-0"
					sandbox="allow-scripts allow-forms"
				/>
				{showUrl && (
					<div
						className={cn(
							"pointer-events-none absolute inset-x-0 z-10 flex justify-center px-3",
							iphoneFill ? "bottom-10 pb-1.5" : "bottom-2 pb-2",
						)}
					>
						<div className="flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 backdrop-blur-md">
							<span className="size-2 shrink-0 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
							<span className="max-w-[180px] truncate font-mono text-foreground text-xs">
								{toDisplayHost(safeIframeSrc)}
							</span>
						</div>
					</div>
				)}
			</div>
		);
	}

	if (imageSrc) {
		return (
			<div
				className={cn("overflow-hidden", rounded, fillClass, contentClassName)}
				style={{ ...contentStyle, ...rs }}
			>
				<img
					src={imageSrc}
					alt={imageAlt}
					loading="lazy"
					decoding="async"
					className="block size-full object-cover"
				/>
			</div>
		);
	}

	if (isVideo) {
		if (embedUrl) {
			return (
				<div
					className={cn(
						"relative overflow-hidden",
						rounded,
						!height && "aspect-video",
					)}
					style={{ ...contentStyle, ...rs }}
				>
					<iframe
						src={embedUrl}
						title={filename ?? videoTitle}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowFullScreen
						className="absolute inset-0 size-full border-0"
					/>
				</div>
			);
		}
		return (
			<VideoPlayer
				src={videoSrc as string}
				autoPlay={autoPlay}
				hoverPlay={hoverPlay}
				rounded={rounded}
				playLabel={playLabel}
				pauseLabel={pauseLabel}
				className={cn(
					iphoneFill
						? "absolute inset-0 size-full"
						: !height
							? "aspect-video"
							: undefined,
					contentClassName,
				)}
			/>
		);
	}

	return (
		<FramePlaceholder
			variant={variant}
			label={label}
			size={size}
			sizePosition={sizePosition}
			rounded={rounded}
			roundedStyle={roundedStyle}
			height={height}
			iphoneFill={iphoneFill}
		/>
	);
}
