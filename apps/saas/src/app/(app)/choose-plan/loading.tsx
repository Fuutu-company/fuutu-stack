import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="mx-auto max-w-6xl space-y-8">
			<div className="text-center">
				<Skeleton className="mx-auto h-10 w-64" />
				<Skeleton className="mx-auto mt-3 h-4 w-96" />
			</div>
			<div className="grid gap-6 md:grid-cols-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton key={i} className="h-80 w-full" />
				))}
			</div>
		</div>
	);
}
