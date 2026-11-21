export type IconColors = {
	background: string;
	areaUsers: string;
	areaBilling: string;
};
export const ICON_SIZE: number;
export const LOGO_SIZE: number;
export function oklchToHex(l: number, c: number, h: number): string;
export function cssColorToHex(value: string): string;
export function brandIconColors(css: string): IconColors;
export function iconBackdropSvg(colors: IconColors): string;
