import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="container mx-auto max-w-2xl space-y-8 px-4 py-16">
			<div className="space-y-4">
				<Skeleton className="h-10 w-40" />
				<Skeleton className="h-5 w-full" />
			</div>
			<div className="flex flex-col gap-4">
				{Array.from({ length: 2 }).map((_, i) => (
					<div key={i} className="space-y-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-5 w-56" />
					</div>
				))}
			</div>
		</div>
	);
}
