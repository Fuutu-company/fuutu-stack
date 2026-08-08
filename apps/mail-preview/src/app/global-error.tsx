"use client";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					padding: 24,
					fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
					background: "#f6f6f7",
					color: "#111",
				}}
			>
				<h1>Something went wrong</h1>
				<p style={{ color: "#6b7280" }}>{error.message}</p>
				<button
					type="button"
					onClick={reset}
					style={{
						marginTop: 16,
						padding: "8px 16px",
						border: "1px solid #d1d5db",
						borderRadius: 6,
						background: "#fff",
						cursor: "pointer",
					}}
				>
					Try again
				</button>
			</body>
		</html>
	);
}
