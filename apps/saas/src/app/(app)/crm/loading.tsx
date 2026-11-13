import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-[400px] w-full" />
		</div>
	);
}
