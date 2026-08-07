import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="space-y-6 p-6">
			<Skeleton className="h-8 w-48" />
			<Skeleton className="h-[400px] w-full" />
		</div>
	);
}
