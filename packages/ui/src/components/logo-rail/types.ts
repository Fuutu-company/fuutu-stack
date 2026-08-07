export type LogoItem = {
	/** Unique identifier */
	id: string;
	/** Display name shown in the tooltip header */
	name: string;
	/** One-liner description shown in the tooltip */
	description: string;
	/** Additional detail line — e.g. how it is used, a tagline, a URL */
	detail?: string;
	/** Absolute public path to the logo image, e.g. "/logos/nextjs.svg" */
	logo: string;
	/** Alt text for the logo image */
	logoAlt: string;
	/** Invert the logo in dark mode — for monochrome-black logos that disappear on dark backgrounds */
	invertInDark?: boolean;
};

export type LogoRailProps = {
	/** Items to render */
	items: LogoItem[];
	/** Extra className forwarded to the outermost wrapper */
	className?: string;
};
