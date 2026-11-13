import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="mx-auto max-w-6xl space-y-8">
			<div className="space-y-3">
				<Skeleton className="h-4 w-28" />
				<Skeleton className="h-9 w-64" />
				<Skeleton className="h-4 w-full max-w-2xl" />
				<Skeleton className="h-4 w-3/4 max-w-xl" />
			</div>
			<div className="grid gap-3 md:grid-cols-3">
				<Skeleton className="h-32 rounded-xl" />
				<Skeleton className="h-32 rounded-xl" />
				<Skeleton className="h-32 rounded-xl" />
			</div>
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-[400px] w-full" />
		</div>
	);
}
