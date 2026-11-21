import { Geist_Mono, Manrope, Schibsted_Grotesk } from "next/font/google";

const sans = Manrope({
	subsets: ["latin"],
	variable: "--font-manrope",
	display: "swap",
});

const heading = Schibsted_Grotesk({
	subsets: ["latin"],
	variable: "--font-schibsted-grotesk",
	display: "swap",
});

const mono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
	display: "swap",
	preload: false,
});

export const fontVariables = `${sans.variable} ${heading.variable} ${mono.variable}`;
