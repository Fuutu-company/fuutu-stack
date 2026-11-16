"use client";

import type { ApiKeyScope } from "@fuutu/api/api-key-scopes";
import { type ReactNode, useState } from "react";
import {
	ApiKeyCreateDialog,
	type ApiKeyCreateDialogProps,
} from "./api-key-create-dialog";
import { ApiKeyCreatedDialog } from "./api-key-created-dialog";

type CreatedKey = { key: string; scopes: readonly ApiKeyScope[] };

/**
 * One entry point for creating an API key anywhere: the create dialog
 * (optionally preset to scopes), then the shown-once reveal. `onCreated`
 * runs when the reveal closes, so a parent list refetches once.
 */
export function CreateApiKeyButton({
	createdHint,
	onCreated,
	...dialogProps
}: Omit<ApiKeyCreateDialogProps, "onCreated"> & {
	/** Next step under the revealed key, e.g. where to store it. */
	createdHint?: (scopes: readonly ApiKeyScope[]) => ReactNode;
	onCreated?: () => void;
}) {
	const [created, setCreated] = useState<CreatedKey | null>(null);

	return (
		<>
			<ApiKeyCreateDialog
				{...dialogProps}
				onCreated={(result, scopes) => setCreated({ key: result.key, scopes })}
			/>
			<ApiKeyCreatedDialog
				apiKey={created?.key ?? null}
				open={created !== null}
				hint={created ? createdHint?.(created.scopes) : undefined}
				onClose={() => {
					setCreated(null);
					onCreated?.();
				}}
			/>
		</>
	);
}
