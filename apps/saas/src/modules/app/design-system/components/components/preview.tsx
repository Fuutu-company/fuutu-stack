import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PREVIEW_STATES, type PreviewState } from "./preview-state";

export type MatrixRow = {
	id: string;
	label: ReactNode;
	/** The sample for `state`, or `null` when the state does not apply. */
	cell: (state: PreviewState) => ReactNode | null;
};

const COLUMNS = "lg:grid-cols-[8rem_repeat(6,minmax(0,1fr))]";

/** Rows of primitives against the six states. Below `lg` each row becomes a labelled card. */
export async function PreviewMatrix({ rows }: { rows: MatrixRow[] }) {
	const t = await getTranslations("designSystem.components.matrix");

	return (
		<div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
			<div
				aria-hidden="true"
				className={`hidden gap-4 border-b bg-muted/50 px-4 py-2.5 lg:grid ${COLUMNS}`}
			>
				<span />
				{PREVIEW_STATES.map((state) => (
					<span
						key={state}
						className="font-medium text-muted-foreground text-xs"
					>
						{t(`states.${state}`)}
					</span>
				))}
			</div>
			<ul className="divide-y">
				{rows.map(({ id, label, cell }) => (
					<li
						key={id}
						className={`grid gap-4 px-4 py-4 lg:items-center ${COLUMNS}`}
					>
						<div className="font-mono text-foreground text-xs">{label}</div>
						<div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:contents">
							{PREVIEW_STATES.map((state) => {
								const sample = cell(state);
								return (
									<div
										key={state}
										className="flex min-w-0 flex-col items-start gap-2"
									>
										<span className="text-muted-foreground text-xs lg:sr-only">
											{t(`states.${state}`)}
										</span>
										{sample === null ? (
											<span className="text-muted-foreground text-sm">
												{t("none")}
											</span>
										) : (
											<div className="w-full min-w-0">{sample}</div>
										)}
									</div>
								);
							})}
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
