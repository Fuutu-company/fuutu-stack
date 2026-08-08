import { cn } from "../lib/utils";

export type BrandLogoSize = "xs" | "sm" | "md" | "lg" | "xl";

export type BrandLogoProps = {
	/** Visual size of the logo image itself */
	size?: BrandLogoSize;
	/** Extra className forwarded to the <img> */
	className?: string;
	/** Alt text — defaults to empty (use when logo is paired with a brand name) */
	alt?: string;
};

const SIZE_MAP: Record<BrandLogoSize, string> = {
	xs: "size-4",
	sm: "size-5",
	md: "size-6",
	lg: "size-7",
	xl: "size-9",
};

export function BrandLogo({
	size = "md",
	className,
	alt = "",
}: BrandLogoProps) {
	return (
		<img
			src="/logo.svg"
			alt={alt}
			className={cn("shrink-0 object-contain", SIZE_MAP[size], className)}
		/>
	);
}
