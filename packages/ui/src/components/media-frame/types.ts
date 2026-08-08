/** Controls where the editorial size watermark is placed. */
export type SizePosition =
	| "bottom-right" // default: large, clipped at corner
	| "bottom-left"
	| "top-right"
	| "top-left"
	| "bottom-right-vertical" // rotated 90°
	| "bottom-left-vertical"; // rotated 90° (used automatically on iPhone)

export type MacFrameVariant =
	| "default"
	| "primary"
	| "violet"
	| "emerald"
	| "amber"
	| "rose";

/** Shared content props used by MediaFrame and its sub-renderers. */
export type FrameContentProps = {
	/** Placeholder background color variant. Default: "default" */
	variant?: MacFrameVariant;
	/** Path or URL to an image — lazy-loaded, fills the frame */
	imageSrc?: string;
	/** Alt text for the image */
	imageAlt?: string;
	/** Path/URL to a video file or YouTube link */
	videoSrc?: string;
	/**
	 * Live website URL rendered in an interactive iframe.
	 * The target site must allow embedding (no X-Frame-Options: DENY).
	 */
	iframeSrc?: string;
	/** Show the URL pill overlay on iframeSrc. Default: true */
	showUrl?: boolean;
	/** Auto-play the video muted on mount */
	autoPlay?: boolean;
	/** Play on hover, pause+reset on mouse-leave */
	hoverPlay?: boolean;
	/** Label shown in the placeholder center */
	label?: string;
	/** Size shown as an editorial watermark */
	size?: string;
	/** Placement of the size watermark. Default: "bottom-right" (desktop) or "bottom-left-vertical" (iPhone). */
	sizePosition?: SizePosition;
	/** Explicit height for the content area. Omit for aspect-video. */
	height?: number | string;
	/** Extra className forwarded to the content wrapper */
	contentClassName?: string;
	/** Arbitrary children — highest priority, bypasses all built-in modes */
	children?: React.ReactNode;
};

export type MediaFrameProps = FrameContentProps & {
	/** Show macOS-style window chrome (titlebar + dots). Default: false */
	chrome?: boolean;
	/** Show iPhone frame shell. Mutually exclusive with chrome. */
	iphone?: boolean;
	/** Filename shown in the titlebar when chrome is enabled */
	filename?: string;
	/** Width of the frame wrapper (e.g. 800, "100%"). Controls overall size. */
	width?: number | string;
	/** Click to expand the frame in-place with a spring animation + backdrop. */
	expandable?: boolean;
	/** Accessible label for the expand button (required when expandable=true) */
	expandLabel?: string;
	className?: string;
};

/** Internal props passed down to FrameContent. */
export type InternalContentProps = FrameContentProps & {
	rounded?: string;
	/** Inline borderRadius override — used when cqi-based radius must override the Tailwind rounded class */
	roundedStyle?: string;
	filename?: string;
	/** Fill the parent absolutely — used inside iPhone frame */
	iphoneFill?: boolean;
};
