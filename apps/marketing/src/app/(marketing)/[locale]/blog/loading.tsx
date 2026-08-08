import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="container mx-auto max-w-3xl space-y-6 px-4 py-16">
			<Skeleton className="h-10 w-48" />
			<Skeleton className="h-5 w-72" />
			<div className="divide-y border-y">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="my-6 h-20 w-full" />
				))}
			</div>
		</div>
	);
}
