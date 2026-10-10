import { ApiKeyList } from "@/modules/app/api-keys/components/api-key-list";

export default async function UserApiKeysPage() {
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<ApiKeyList />
		</div>
	);
}
