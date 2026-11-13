import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-[calc(100dvh-9rem)] w-full" />
		</div>
	);
}
