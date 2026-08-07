import { cn } from "../../lib/utils";
import { FrameContent } from "./frame-content";
import type { MediaFrameProps } from "./types";

type FrameIphoneProps = Pick<
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
	| "contentClassName"
	| "width"
	| "className"
	| "children"
> & { autoFilename: string };

export function FrameIphone({
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
	contentClassName,
	width,
	className,
	autoFilename,
	children,
}: FrameIphoneProps) {
	return (
		<div
			style={width ? { width } : undefined}
			className={cn("@container/iphone relative mx-auto w-[300px]", className)}
		>
			{/* Left side buttons — positions as % of total device height (aspect 9/20.1 ≈ 0.448) */}
			{/* mute: ~13.5% top, ~4.5% height | vol+: ~19.6% | vol-: ~26.3% */}
			<div
				className="absolute -left-[1.3%] w-[1.3%] rounded-l-full bg-zinc-600 shadow-sm"
				style={{ top: "13.5%", height: "4.5%" }}
			/>
			<div
				className="absolute -left-[1.3%] w-[1.3%] rounded-l-full bg-zinc-600 shadow-sm"
				style={{ top: "19.6%", height: "7.5%" }}
			/>
			<div
				className="absolute -left-[1.3%] w-[1.3%] rounded-l-full bg-zinc-600 shadow-sm"
				style={{ top: "26.3%", height: "7.5%" }}
			/>
			{/* Right power button — ~19.6% top, ~10% height */}
			<div
				className="absolute -right-[1.3%] w-[1.3%] rounded-r-full bg-zinc-600 shadow-sm"
				style={{ top: "19.6%", height: "10%" }}
			/>

			{/* Outer shell — dark titanium, real device aspect ratio 71.5×159.9 mm ≈ 9/20.1 */}
			<div
				className="relative shadow-[0_30px_80px_-10px_rgba(0,0,0,0.6)]"
				style={{
					aspectRatio: "9/20.1",
					padding: "1.2cqi",
					borderRadius: "clamp(16px, 10cqi, 48px)",
					background:
						"linear-gradient(145deg, #4a4a4a 0%, #1a1a1a 40%, #2d2d2d 70%, #111 100%)",
				}}
			>
				{/* Inner bezel — fills the shell, screen content fills this */}
				<div
					className="relative size-full overflow-hidden bg-black"
					style={{ borderRadius: "clamp(14px, 9cqi, 43px)" }}
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
						contentClassName={contentClassName}
						filename={autoFilename}
						rounded="rounded-none"
						iphoneFill
					>
						{children}
					</FrameContent>

					{/* Gloss highlight — overlaid */}
					<div
						className="pointer-events-none absolute inset-x-0 top-0 z-20 opacity-[0.06]"
						style={{
							height: "20%",
							background: "linear-gradient(180deg, white 0%, transparent 100%)",
						}}
					/>
					{/* Dynamic Island — overlaid on top, scales with container width via cqi */}
					<div
						className="absolute inset-x-0 top-0 z-10 flex justify-center"
						style={{ paddingTop: "2.5%" }}
					>
						<div
							className="rounded-full"
							style={{
								height: "clamp(10px, 6cqi, 20px)",
								width: "clamp(40px, 28cqi, 90px)",
								background: "#0a0a0a",
								boxShadow: "inset 0 1px 2px rgba(255,255,255,0.08)",
							}}
						/>
					</div>
					{/* Home indicator — overlaid at bottom, scales with container width */}
					<div
						className="absolute inset-x-0 bottom-0 z-10 flex justify-center"
						style={{ paddingBottom: "1.5%" }}
					>
						<div
							className="rounded-full bg-white/30"
							style={{
								height: "clamp(2px, 1.2cqi, 5px)",
								width: "clamp(30px, 24cqi, 90px)",
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
