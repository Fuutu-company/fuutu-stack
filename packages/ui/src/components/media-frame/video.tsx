"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

type VideoPlayerProps = {
	src: string;
	autoPlay?: boolean;
	hoverPlay?: boolean;
	rounded?: string;
	className?: string;
	/** Accessible label for the play state of the toggle button. */
	playLabel?: string;
	/** Accessible label for the pause state of the toggle button. */
	pauseLabel?: string;
};

export function VideoPlayer({
	src,
	autoPlay = false,
	hoverPlay = false,
	rounded = "rounded-2xl",
	className,
	playLabel,
	pauseLabel,
}: VideoPlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const mountedRef = useRef(true);
	const [playing, setPlaying] = useState(false);
	const [hovered, setHovered] = useState(false);

	// Tracks mount state so async play() resolutions can't set state after unmount
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	// Auto-play on mount (muted required by browsers)
	useEffect(() => {
		const video = videoRef.current;
		if (!video || !autoPlay) return;
		let cancelled = false;
		video.muted = true;
		video
			.play()
			.then(() => {
				if (!cancelled) setPlaying(true);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [autoPlay]);

	// Hover-to-play
	useEffect(() => {
		const video = videoRef.current;
		if (!video || !hoverPlay) return;
		let cancelled = false;
		if (hovered) {
			video.muted = true;
			video
				.play()
				.then(() => {
					if (!cancelled) setPlaying(true);
				})
				.catch(() => {});
		} else {
			video.pause();
			video.currentTime = 0;
			setPlaying(false);
		}
		return () => {
			cancelled = true;
		};
	}, [hovered, hoverPlay]);

	// Pause when hoverPlay is disabled mid-hover — the hover effect above
	// early-returns on !hoverPlay, so the transition is handled here
	const prevHoverPlay = useRef(hoverPlay);
	useEffect(() => {
		const wasEnabled = prevHoverPlay.current;
		prevHoverPlay.current = hoverPlay;
		const video = videoRef.current;
		if (wasEnabled && !hoverPlay && video && !video.paused) {
			video.pause();
			setPlaying(false);
		}
	}, [hoverPlay]);

	const togglePlay = useCallback(() => {
		const video = videoRef.current;
		if (!video) return;
		if (video.paused) {
			video
				.play()
				.then(() => {
					if (mountedRef.current) setPlaying(true);
				})
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
						aria-label={playing ? pauseLabel : playLabel}
						className={cn(
							"flex size-9 items-center justify-center rounded-full bg-background/60 text-foreground backdrop-blur-sm transition-opacity duration-200 hover:bg-background/80",
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
