import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="space-y-6">
			<div>
				<Skeleton className="h-8 w-48" />
				<Skeleton className="mt-2 h-4 w-64" />
			</div>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-28 w-full" />
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-2">
				<Skeleton className="h-[300px] w-full" />
				<Skeleton className="h-[300px] w-full" />
			</div>
		</div>
	);
}
