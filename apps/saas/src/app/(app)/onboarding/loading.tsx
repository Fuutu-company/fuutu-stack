import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="container mx-auto space-y-6 px-4 py-12 md:py-20">
			<Skeleton className="h-8 w-48" />
			<Skeleton className="h-[400px] w-full" />
		</div>
	);
}
