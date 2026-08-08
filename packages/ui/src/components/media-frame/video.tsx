"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

type VideoPlayerProps = {
	src: string;
	autoPlay?: boolean;
	hoverPlay?: boolean;
	rounded?: string;
	className?: string;
};

export function VideoPlayer({
	src,
	autoPlay = false,
	hoverPlay = false,
	rounded = "rounded-2xl",
	className,
}: VideoPlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [playing, setPlaying] = useState(false);
	const [hovered, setHovered] = useState(false);

	// Auto-play on mount (muted required by browsers)
	useEffect(() => {
		const video = videoRef.current;
		if (!video || !autoPlay) return;
		video.muted = true;
		video
			.play()
			.then(() => setPlaying(true))
			.catch(() => {});
	}, [autoPlay]);

	// Hover-to-play
	useEffect(() => {
		const video = videoRef.current;
		if (!video || !hoverPlay) return;
		if (hovered) {
			video.muted = true;
			video
				.play()
				.then(() => setPlaying(true))
				.catch(() => {});
		} else {
			video.pause();
			video.currentTime = 0;
			setPlaying(false);
		}
	}, [hovered, hoverPlay]);

	const togglePlay = useCallback(() => {
		const video = videoRef.current;
		if (!video) return;
		if (video.paused) {
			video
				.play()
				.then(() => setPlaying(true))
				.catch(() => {});
		} else {
			video.pause();
			setPlaying(false);
		}
	}, []);

	const showControls = autoPlay || hoverPlay;
	const showOverlay = !hoverPlay || hovered;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover events control video playback, not keyboard navigation
		<div
			className={cn("relative overflow-hidden", rounded, className)}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<video
				ref={videoRef}
				src={src}
				loop
				muted
				playsInline
				preload="metadata"
				className="block size-full object-cover"
			/>

			{/* Play/pause button — always visible for manual, fade-in on hover for auto/hover modes */}
			{(!showControls || showOverlay) && (
				<div className="absolute inset-0 flex items-end justify-start p-3">
					<button
						type="button"
						onClick={togglePlay}
						aria-label={playing ? "Pause" : "Play"}
						className={cn(
							"flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity duration-200 hover:bg-black/70",
							showControls && !hovered ? "opacity-0" : "opacity-100",
						)}
					>
						{playing ? (
							<svg
								viewBox="0 0 16 16"
								className="size-4 fill-current"
								aria-hidden="true"
							>
								<rect x="3" y="2" width="3.5" height="12" rx="1" />
								<rect x="9.5" y="2" width="3.5" height="12" rx="1" />
							</svg>
						) : (
							<svg
								viewBox="0 0 16 16"
								className="size-4 fill-current"
								aria-hidden="true"
							>
								<path d="M3 2.5l10 5.5-10 5.5V2.5z" />
							</svg>
						)}
					</button>
				</div>
			)}
		</div>
	);
}
