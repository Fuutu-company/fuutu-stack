import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="mx-auto max-w-6xl space-y-8">
			<div className="grid gap-6 md:grid-cols-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton key={i} className="h-80 w-full" />
				))}
			</div>
		</div>
	);
}
