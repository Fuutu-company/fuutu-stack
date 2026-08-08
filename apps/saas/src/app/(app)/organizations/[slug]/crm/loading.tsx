import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="space-y-4">
			<div>
				<Skeleton className="h-8 w-48" />
				<Skeleton className="mt-2 h-4 w-64" />
			</div>
			<Skeleton className="h-[400px] w-full" />
		</div>
	);
}
