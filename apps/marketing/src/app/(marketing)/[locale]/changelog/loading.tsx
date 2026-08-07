import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="container mx-auto max-w-3xl space-y-6 px-4 py-16">
			<Skeleton className="h-10 w-48" />
			<Skeleton className="h-5 w-72" />
			<div className="flex flex-col gap-12 pt-6">
				{Array.from({ length: 3 }).map((_, i) => (
					<div key={i} className="space-y-3 border-l-2 pl-6">
						<Skeleton className="h-3 w-40" />
						<Skeleton className="h-6 w-2/3" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-5/6" />
					</div>
				))}
			</div>
		</div>
	);
}
