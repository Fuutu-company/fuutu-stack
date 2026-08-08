import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
	title: "Fuutu · Mail Preview",
	description: "Dev tool for @fuutu/mail templates.",
	robots: { index: false, follow: false },
	icons: {
		icon: [
			{ url: "/favicon/favicon.svg", type: "image/svg+xml" },
			{ url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
		],
	},
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
					background: "#f6f6f7",
					color: "#111",
				}}
			>
				{children}
			</body>
		</html>
	);
}
