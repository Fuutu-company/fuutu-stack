import { cn } from "../lib/utils";

export type BrandLogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export type BrandLogoProps = {
	/** Visual size of the logo image itself */
	size?: BrandLogoSize;
	/** Extra className forwarded to the <img> */
	className?: string;
	/** Alt text — defaults to empty (use when logo is paired with a brand name) */
	alt?: string;
	/** Image source — defaults to "/logo.svg" served from the app's public dir */
	src?: string;
};

const SIZE_MAP: Record<BrandLogoSize, string> = {
	xs: "size-4",
	sm: "size-5",
	md: "size-6",
	lg: "size-7",
	xl: "size-9",
	"2xl": "size-12",
};

export function BrandLogo({
	size = "md",
	className,
	alt = "",
	src = "/logo.svg",
}: BrandLogoProps) {
	return (
		<img
			src={src}
			alt={alt}
			className={cn("shrink-0 object-contain", SIZE_MAP[size], className)}
		/>
	);
}
