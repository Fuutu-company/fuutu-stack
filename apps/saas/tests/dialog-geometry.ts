import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures";

/** Phone and desktop viewports every dialog has to fit. */
export const DIALOG_VIEWPORTS = [
	{ width: 375, height: 700 },
	{ width: 1280, height: 800 },
] as const;

/** Minimum gap between a dialog and the viewport edge below `sm`. */
const MOBILE_INSET_PX = 16;
/** Sub-pixel rounding between boundingBox values. */
const EPSILON_PX = 0.5;

/**
 * Asserts that every button and code element of an open dialog lies inside
 * the dialog box, and that the dialog keeps a 16 px inset from both viewport
 * edges on a phone. Waits for the open animation first — a zooming dialog
 * reports a scaled box.
 */
export async function expectContentInsideDialog(
	page: Page,
	dialog: Locator,
): Promise<void> {
	await expect(dialog).toBeVisible();
	await expect
		.poll(() => dialog.evaluate((el) => el.getAnimations().length))
		.toBe(0);
	const box = await dialog.boundingBox();
	if (!box) throw new Error("dialog has no bounding box");
	const viewport = page.viewportSize();
	if (!viewport) throw new Error("page has no viewport");

	expect(box.x, "dialog left edge").toBeGreaterThanOrEqual(-EPSILON_PX);
	expect(box.x + box.width, "dialog right edge").toBeLessThanOrEqual(
		viewport.width + EPSILON_PX,
	);
	if (viewport.width < 640) {
		expect(box.x, "inset left").toBeGreaterThanOrEqual(
			MOBILE_INSET_PX - EPSILON_PX,
		);
		expect(
			viewport.width - (box.x + box.width),
			"inset right",
		).toBeGreaterThanOrEqual(MOBILE_INSET_PX - EPSILON_PX);
	}

	const parts = await dialog.locator("button, code").all();
	expect(parts.length).toBeGreaterThan(0);
	for (const part of parts) {
		// The code element holds the secret — never print it in a failure.
		const isCode = await part.evaluate((el) => el.tagName === "CODE");
		const label = isCode
			? "code"
			: ((await part.getAttribute("aria-label")) ??
				((await part.textContent())?.trim() || "button"));
		const inner = await part.boundingBox();
		if (!inner) continue;
		expect(inner.x, `${label} left edge`).toBeGreaterThanOrEqual(
			box.x - EPSILON_PX,
		);
		expect(inner.x + inner.width, `${label} right edge`).toBeLessThanOrEqual(
			box.x + box.width + EPSILON_PX,
		);
	}
}
