import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<Skeleton className="h-[200px] w-full" />
		</div>
	);
}
