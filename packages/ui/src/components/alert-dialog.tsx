"use client";

/**
 * AlertDialog — a confirmation-style modal with destructive/affirmative actions.
 *
 * Implemented on top of our existing Dialog (Radix) rather than pulling in the
 * separate `@radix-ui/react-alert-dialog` package. Keeps the surface identical
 * to shadcn's AlertDialog so call-sites are drop-in compatible.
 */

import type { VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../lib/utils";
import { Button, type buttonVariants } from "./button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./dialog";

export const AlertDialog = Dialog;
export const AlertDialogTrigger = DialogTrigger;
export const AlertDialogContent = DialogContent;
export const AlertDialogHeader = DialogHeader;
export const AlertDialogFooter = DialogFooter;
export const AlertDialogTitle = DialogTitle;
export const AlertDialogDescription = DialogDescription;

export function AlertDialogCancel({
	className,
	...props
}: React.ComponentProps<typeof Button>) {
	return (
		<DialogClose asChild>
			<Button
				variant="outline"
				className={cn("mt-2 sm:mt-0", className)}
				{...props}
			/>
		</DialogClose>
	);
}

type AlertActionProps = React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants>;

export function AlertDialogAction({
	className,
	variant,
	size,
	...props
}: AlertActionProps) {
	return (
		<DialogClose asChild>
			<Button variant={variant} size={size} className={className} {...props} />
		</DialogClose>
	);
}
