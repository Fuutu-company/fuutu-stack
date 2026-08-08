import { Skeleton } from "@fuutu/ui";

export default function Loading() {
	return (
		<div className="space-y-24 py-16">
			<div className="container mx-auto max-w-4xl space-y-6 px-4 text-center">
				<Skeleton className="mx-auto h-14 w-2/3" />
				<Skeleton className="mx-auto h-6 w-full max-w-2xl" />
				<Skeleton className="mx-auto h-6 w-4/5" />
				<div className="flex justify-center gap-3 pt-4">
					<Skeleton className="h-11 w-36 rounded-full" />
					<Skeleton className="h-11 w-36 rounded-full" />
				</div>
			</div>
			<div className="container mx-auto max-w-6xl px-4">
				<div className="grid gap-6 md:grid-cols-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-48 w-full" />
					))}
				</div>
			</div>
		</div>
	);
}
