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
	cn,
	Skeleton,
} from "@fuutu/ui";
import { MessageSquare, MessagesSquare, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Conversation = {
	id: string;
	title: string;
	updatedAt: string | Date;
};

type ChatSidebarProps = {
	conversations: Conversation[];
	activeId: string | null;
	loading: boolean;
	onSelect: (id: string) => void;
	onNew: () => void;
	onDelete: (id: string) => void;
};

export function ChatSidebar({
	conversations,
	activeId,
	loading,
	onSelect,
	onNew,
	onDelete,
}: ChatSidebarProps) {
	const t = useTranslations("chat");
	const [deleteId, setDeleteId] = useState<string | null>(null);

	return (
		<div className="flex h-full w-64 flex-col border-r">
			<div className="p-3">
				<Button onClick={onNew} className="w-full" variant="outline">
					<Plus className="mr-2 size-4" />
					{t("newConversation")}
				</Button>
			</div>
			<div className="flex-1 overflow-y-auto px-2 pb-2">
				{loading ? (
					<div className="space-y-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</div>
				) : conversations.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 px-2 py-8 text-center">
						<MessagesSquare className="size-6 text-muted-foreground" />
						<p className="text-muted-foreground text-sm">
							{t("noConversations")}
						</p>
					</div>
				) : (
					<div className="space-y-1">
						{conversations.map((conv) => (
							<div
								key={conv.id}
								className={cn(
									"group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
									activeId === conv.id
										? "bg-accent text-accent-foreground"
										: "hover:bg-accent/50",
								)}
							>
								<button
									type="button"
									onClick={() => onSelect(conv.id)}
									className="flex flex-1 items-center gap-2 overflow-hidden text-left"
								>
									<MessageSquare className="size-4 shrink-0 text-muted-foreground" />
									<span className="truncate">{conv.title}</span>
								</button>
								<AlertDialog
									open={deleteId === conv.id}
									onOpenChange={(open) => {
										if (!open) setDeleteId(null);
									}}
								>
									<AlertDialogTrigger asChild>
										<button
											type="button"
											aria-label={t("deleteConversationAria")}
											className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
											onClick={(e) => {
												e.stopPropagation();
												setDeleteId(conv.id);
											}}
										>
											<Trash2 className="size-3.5" />
										</button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												{t("deleteConversation")}
											</AlertDialogTitle>
											<AlertDialogDescription>
												{t("deleteConfirmation")}
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => {
													onDelete(conv.id);
													setDeleteId(null);
												}}
											>
												{t("confirmDelete")}
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
