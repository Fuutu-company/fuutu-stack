"use client";

import { createLogger } from "@fuutu/logs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import { adminErrorKey } from "./admin-error";

const log = createLogger({ scope: "admin-actions" });

/** Runs an admin call, toasts the outcome and refreshes admin queries. */
export function useAdminAction<TVars, TResult = unknown>(options: {
	mutationFn: (vars: TVars) => Promise<TResult>;
	/** Translation key under `admin.*`; a function picks it from the result. */
	successKey: string | ((result: TResult) => { key: string; warn?: boolean });
	onSuccess?: () => void;
	/**
	 * The success handler leaves the page with a full navigation (new
	 * session cookies). Admin queries are cancelled instead of refetched:
	 * a refetch would run with the new cookie and answer 403.
	 */
	navigatesAway?: boolean;
}) {
	const t = useTranslations("admin");
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: options.mutationFn,
		onSuccess: async (result) => {
			const outcome =
				typeof options.successKey === "function"
					? options.successKey(result)
					: { key: options.successKey, warn: false };
			if (outcome.warn) toast.warning(t(outcome.key));
			else toast.success(t(outcome.key));
			if (options.navigatesAway) {
				await queryClient.cancelQueries({ queryKey: orpc.admin.key() });
			} else {
				await queryClient.invalidateQueries({ queryKey: orpc.admin.key() });
			}
			options.onSuccess?.();
		},
		onError: (error) => {
			log.error("admin action failed", { err: error });
			toast.error(t(`errors.${adminErrorKey(error)}`));
		},
	});
}
