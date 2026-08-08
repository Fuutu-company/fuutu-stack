import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<Skeleton className="h-8 w-48" />
			<div className="grid gap-4 md:grid-cols-2">
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		</div>
	);
}
