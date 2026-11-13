import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { type Area, AreaIcon } from "./area";

interface PageHeaderBaseProps {
	title: ReactNode;
	actions?: ReactNode;
	className?: string;
}

interface PageHeaderDefaultProps extends PageHeaderBaseProps {
	variant?: "default";
	description?: ReactNode;
	/** Rendered before the title; tinted with `area` when given. */
	icon?: ReactNode;
	area?: Area;
}

/**
 * For pages whose location is already named elsewhere (an app shell's
 * breadcrumb): the title becomes a visually hidden h1 and only `actions`
 * render, as a right-aligned row. Without actions it takes no space.
 */
interface PageHeaderCompactProps extends PageHeaderBaseProps {
	variant: "compact";
	description?: never;
	icon?: never;
	area?: never;
}

type PageHeaderProps = PageHeaderDefaultProps | PageHeaderCompactProps;

export function PageHeader(props: PageHeaderProps) {
	if (props.variant === "compact") return <CompactPageHeader {...props} />;

	const { title, description, actions, icon, area, className } = props;
	const leading = icon ? (
		area ? (
			<AreaIcon area={area}>{icon}</AreaIcon>
		) : (
			<span
				aria-hidden="true"
				className="inline-flex size-9 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-5"
			>
				{icon}
			</span>
		)
	) : null;

	return (
		<header
			data-slot="page-header"
			className={cn(
				"flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
				className,
			)}
		>
			<div className="min-w-0 space-y-1.5">
				<div className="flex items-center gap-3">
					{leading}
					<h1 className="min-w-0 break-words font-extrabold font-heading text-3xl leading-tight tracking-heading md:text-4xl">
						{title}
					</h1>
				</div>
				{description ? (
					<p className="max-w-2xl text-muted-foreground text-sm leading-6">
						{description}
					</p>
				) : null}
			</div>
			{actions ? (
				<div
					data-slot="page-header-actions"
					className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end"
				>
					{actions}
				</div>
			) : null}
		</header>
	);
}

function CompactPageHeader({
	title,
	actions,
	className,
}: PageHeaderCompactProps) {
	if (!actions) {
		return (
			<h1
				data-slot="page-header"
				data-variant="compact"
				className={cn("sr-only", className)}
			>
				{title}
			</h1>
		);
	}
	return (
		<header
			data-slot="page-header"
			data-variant="compact"
			className={cn("flex flex-wrap items-center justify-end gap-2", className)}
		>
			<h1 className="sr-only">{title}</h1>
			<div
				data-slot="page-header-actions"
				className="flex flex-wrap items-center justify-end gap-2"
			>
				{actions}
			</div>
		</header>
	);
}
