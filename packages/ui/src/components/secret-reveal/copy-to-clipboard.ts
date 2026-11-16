/**
 * Writes `text` to the clipboard. Resolves `false` instead of throwing
 * when there is no clipboard (insecure origin) or the write is rejected
 * (permission denied), so callers can show a fallback.
 */
export async function copyToClipboard(
	text: string,
	clipboard: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator
		?.clipboard,
): Promise<boolean> {
	if (!clipboard) return false;
	try {
		await clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
