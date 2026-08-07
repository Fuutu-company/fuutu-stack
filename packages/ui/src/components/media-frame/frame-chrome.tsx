import { cn } from "../../lib/utils";
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
			{/* macOS titlebar — scales with container via cqi */}
			<div
				className="flex items-center overflow-hidden border-border border-b bg-muted"
				style={{
					borderRadius: "clamp(5px, 3cqi, 18px) clamp(5px, 3cqi, 18px) 0 0",
					gap: "clamp(3px, 1.5cqi, 10px)",
					paddingInline: "clamp(6px, 3cqi, 20px)",
					paddingBlock: "clamp(3px, 1.2cqi, 10px)",
				}}
			>
				<span
					className="rounded-full bg-[#ff5f57]"
					style={{
						width: "clamp(6px, 2cqi, 12px)",
						height: "clamp(6px, 2cqi, 12px)",
					}}
				/>
				<span
					className="rounded-full bg-[#febc2e]"
					style={{
						width: "clamp(6px, 2cqi, 12px)",
						height: "clamp(6px, 2cqi, 12px)",
					}}
				/>
				<span
					className="rounded-full bg-[#28c840]"
					style={{
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
			>
				{children}
			</FrameContent>
		</div>
	);
}
