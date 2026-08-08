import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<Skeleton className="h-8 w-48" />
			<Skeleton className="h-[400px] w-full" />
		</div>
	);
}
