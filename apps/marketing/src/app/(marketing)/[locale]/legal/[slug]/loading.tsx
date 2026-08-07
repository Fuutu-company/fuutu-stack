import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<article className="container mx-auto max-w-3xl space-y-8 px-4 py-16">
			<div className="space-y-4">
				<Skeleton className="h-10 w-3/4" />
				<Skeleton className="h-4 w-32" />
			</div>
			<div className="space-y-4">
				{Array.from({ length: 10 }).map((_, i) => (
					<Skeleton key={i} className="h-4 w-full" />
				))}
			</div>
		</article>
	);
}
