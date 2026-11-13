"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Button,
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { richCode } from "../design-section";
import { DesignSubsection } from "../design-subsection";
import { ToastDemo } from "./toast-demo";

function OverlayCard({
	title,
	description,
	children,
	wide = false,
}: {
	title: string;
	description: string;
	children: ReactNode;
	wide?: boolean;
}) {
	return (
		<li
			className={cn(
				"flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm",
				wide && "lg:col-span-3 lg:flex-row lg:items-center lg:justify-between",
			)}
		>
			<div className="space-y-1">
				<h4 className="font-medium text-sm">{title}</h4>
				<p className="text-muted-foreground text-xs leading-4">{description}</p>
			</div>
			<div className="mt-auto flex">{children}</div>
		</li>
	);
}

function DropdownDemo() {
	const t = useTranslations("designSystem.components.overlays.dropdown");
	const [showArchived, setShowArchived] = useState(true);
	const [density, setDensity] = useState("comfortable");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">{t("trigger")}</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-60" align="start">
				<DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
				<DropdownMenuGroup>
					<DropdownMenuItem>
						{t("profile")}
						<DropdownMenuShortcut>{t("profileShortcut")}</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem>
						{t("billing")}
						<DropdownMenuShortcut>{t("billingShortcut")}</DropdownMenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuCheckboxItem
					checked={showArchived}
					onCheckedChange={setShowArchived}
				>
					{t("archived")}
				</DropdownMenuCheckboxItem>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup value={density} onValueChange={setDensity}>
					<DropdownMenuRadioItem value="comfortable">
						{t("comfortable")}
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="compact">
						{t("compact")}
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>{t("more")}</DropdownMenuSubTrigger>
					<DropdownMenuPortal>
						<DropdownMenuSubContent>
							<DropdownMenuItem>{t("export")}</DropdownMenuItem>
							<DropdownMenuItem>{t("import")}</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuPortal>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function Overlays() {
	const t = useTranslations("designSystem.components.overlays");

	return (
		<DesignSubsection
			title={t("title")}
			description={t.rich("description", richCode)}
		>
			<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<OverlayCard
					title={t("dialog.title")}
					description={t("dialog.description")}
				>
					<Dialog>
						<DialogTrigger asChild>
							<Button variant="outline">{t("dialog.trigger")}</Button>
						</DialogTrigger>
						<DialogContent closeLabel={t("closeLabel")}>
							<DialogHeader>
								<DialogTitle>{t("dialog.heading")}</DialogTitle>
								<DialogDescription>{t("dialog.body")}</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<DialogClose asChild>
									<Button variant="outline">{t("dialog.cancel")}</Button>
								</DialogClose>
								<DialogClose asChild>
									<Button>{t("dialog.confirm")}</Button>
								</DialogClose>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</OverlayCard>

				<OverlayCard
					title={t("alertDialog.title")}
					description={t("alertDialog.description")}
				>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="destructive">{t("alertDialog.trigger")}</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>{t("alertDialog.heading")}</AlertDialogTitle>
								<AlertDialogDescription>
									{t("alertDialog.body")}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>{t("alertDialog.cancel")}</AlertDialogCancel>
								<AlertDialogAction>{t("alertDialog.action")}</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</OverlayCard>

				<OverlayCard
					title={t("sheet.title")}
					description={t("sheet.description")}
				>
					<Sheet>
						<SheetTrigger asChild>
							<Button variant="outline">{t("sheet.trigger")}</Button>
						</SheetTrigger>
						<SheetContent closeLabel={t("closeLabel")}>
							<SheetHeader>
								<SheetTitle>{t("sheet.heading")}</SheetTitle>
								<SheetDescription>{t("sheet.body")}</SheetDescription>
							</SheetHeader>
							<SheetFooter>
								<SheetClose asChild>
									<Button variant="outline">{t("sheet.close")}</Button>
								</SheetClose>
							</SheetFooter>
						</SheetContent>
					</Sheet>
				</OverlayCard>

				<OverlayCard
					title={t("dropdown.title")}
					description={t("dropdown.description")}
				>
					<DropdownDemo />
				</OverlayCard>

				<OverlayCard
					title={t("tooltip.title")}
					description={t("tooltip.description")}
				>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline">{t("tooltip.trigger")}</Button>
							</TooltipTrigger>
							<TooltipContent>{t("tooltip.text")}</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</OverlayCard>

				<OverlayCard
					title={t("select.title")}
					description={t("select.description")}
				>
					<Select>
						<SelectTrigger className="w-full" aria-label={t("select.aria")}>
							<SelectValue placeholder={t("select.placeholder")} />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectLabel>{t("select.europe")}</SelectLabel>
								<SelectItem value="fra">{t("select.frankfurt")}</SelectItem>
								<SelectItem value="dub">{t("select.dublin")}</SelectItem>
							</SelectGroup>
							<SelectSeparator />
							<SelectGroup>
								<SelectLabel>{t("select.americas")}</SelectLabel>
								<SelectItem value="iad">{t("select.virginia")}</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</OverlayCard>

				<OverlayCard
					wide
					title={t("toast.title")}
					description={t("toast.description")}
				>
					<ToastDemo />
				</OverlayCard>
			</ul>
		</DesignSubsection>
	);
}
