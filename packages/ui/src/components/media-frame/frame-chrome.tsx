import { cn } from "../../lib/utils";
import { DEVICE_CHROME } from "./constants";
import { FrameContent } from "./frame-content";
import type { MediaFrameProps } from "./types";

type FrameChromeProps = Pick<
	MediaFrameProps,
	| "variant"
	| "imageSrc"
	| "imageAlt"
	| "videoSrc"
	| "iframeSrc"
	| "showUrl"
	| "autoPlay"
	| "hoverPlay"
	| "label"
	| "size"
	| "sizePosition"
	| "height"
	| "contentClassName"
	| "width"
	| "className"
	| "playLabel"
	| "pauseLabel"
	| "videoTitle"
	| "children"
> & { autoFilename: string };

export function FrameChrome({
	variant,
	imageSrc,
	imageAlt,
	videoSrc,
	iframeSrc,
	showUrl,
	autoPlay,
	hoverPlay,
	label,
	size,
	sizePosition,
	height,
	contentClassName,
	width,
	className,
	autoFilename,
	playLabel,
	pauseLabel,
	videoTitle,
	children,
}: FrameChromeProps) {
	return (
		<div
			className={cn(
				"@container/chrome overflow-hidden border-2 border-border bg-muted shadow-xl",
				className,
			)}
			style={{
				...(width ? { width } : {}),
				borderRadius: "clamp(6px, 3cqi, 20px)",
			}}
		>
			{/* macOS titlebar — scales with container via cqi; dark picks the *-dark vars (resolved via classes — inline vars can't be overridden by dark: utilities) */}
			<div
				className="flex items-center overflow-hidden border-(--mf-titlebar-border) border-b bg-(--mf-titlebar-bg) dark:border-(--mf-titlebar-border-dark) dark:bg-(--mf-titlebar-bg-dark)"
				style={
					{
						"--mf-titlebar-bg": DEVICE_CHROME.macTitlebarBg,
						"--mf-titlebar-bg-dark": DEVICE_CHROME.macTitlebarBgDark,
						"--mf-titlebar-border": DEVICE_CHROME.macTitlebarBorder,
						"--mf-titlebar-border-dark": DEVICE_CHROME.macTitlebarBorderDark,
						borderRadius: "clamp(5px, 3cqi, 18px) clamp(5px, 3cqi, 18px) 0 0",
						gap: "clamp(3px, 1.5cqi, 10px)",
						paddingInline: "clamp(6px, 3cqi, 20px)",
						paddingBlock: "clamp(3px, 1.2cqi, 10px)",
					} as React.CSSProperties
				}
			>
				<span
					className="rounded-full"
					style={{
						background: DEVICE_CHROME.trafficClose,
						width: "clamp(6px, 2cqi, 12px)",
						height: "clamp(6px, 2cqi, 12px)",
					}}
				/>
				<span
					className="rounded-full"
					style={{
						background: DEVICE_CHROME.trafficMinimize,
						width: "clamp(6px, 2cqi, 12px)",
						height: "clamp(6px, 2cqi, 12px)",
					}}
				/>
				<span
					className="rounded-full"
					style={{
						background: DEVICE_CHROME.trafficMaximize,
						width: "clamp(6px, 2cqi, 12px)",
						height: "clamp(6px, 2cqi, 12px)",
					}}
				/>
				<div
					className="mx-auto flex min-w-0 items-center overflow-hidden border border-border/50 bg-background/50"
					style={{
						borderRadius: "clamp(3px, 1cqi, 6px)",
						gap: "clamp(2px, 1cqi, 6px)",
						paddingInline: "clamp(4px, 2cqi, 12px)",
						paddingBlock: "clamp(1px, 0.5cqi, 4px)",
					}}
				>
					<span
						className="rounded-full bg-muted-foreground/40"
						style={{
							width: "clamp(4px, 1.2cqi, 8px)",
							height: "clamp(4px, 1.2cqi, 8px)",
						}}
					/>
					<span
						className="min-w-0 truncate font-mono text-muted-foreground"
						style={{ fontSize: "clamp(9px, 1.6cqi, 13px)" }}
					>
						{autoFilename}
					</span>
				</div>
			</div>
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
				filename={autoFilename}
				rounded="rounded-none"
				roundedStyle="0"
				playLabel={playLabel}
				pauseLabel={pauseLabel}
				videoTitle={videoTitle}
			>
				{children}
			</FrameContent>
		</div>
	);
}
