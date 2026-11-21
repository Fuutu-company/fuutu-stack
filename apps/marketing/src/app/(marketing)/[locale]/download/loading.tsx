import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="container mx-auto max-w-3xl space-y-6 px-4 py-16">
			<Skeleton className="h-10 w-48" />
			<Skeleton className="h-5 w-72" />
			<div className="grid gap-4 pt-6 sm:grid-cols-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton key={i} className="h-32 w-full" />
				))}
			</div>
		</div>
	);
}
