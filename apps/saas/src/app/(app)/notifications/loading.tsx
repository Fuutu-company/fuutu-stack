import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<Skeleton className="h-[400px] w-full" />
		</div>
	);
}
