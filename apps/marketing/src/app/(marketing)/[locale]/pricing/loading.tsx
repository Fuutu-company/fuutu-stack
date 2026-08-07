import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="space-y-16 py-16">
			<div className="container mx-auto max-w-6xl space-y-4 px-4 text-center">
				<Skeleton className="mx-auto h-10 w-40" />
				<Skeleton className="mx-auto h-5 w-full max-w-2xl" />
			</div>
			<div className="container mx-auto max-w-6xl px-4">
				<div className="grid gap-6 md:grid-cols-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-80 w-full" />
					))}
				</div>
			</div>
		</div>
	);
}
