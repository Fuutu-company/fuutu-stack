/** Shared class strings for the landing's large pill buttons. */
export const PILL_BUTTON =
	"h-12 px-6 font-bold text-[0.9375rem] hover:-translate-y-px has-[>svg]:px-6 motion-reduce:hover:translate-y-0";

/** Primary (ink) pill. */
export const INK_BUTTON = `${PILL_BUTTON} shadow-lg`;

/** Soft surface pill: card fill and shadow instead of a border. */
export const SOFT_BUTTON = `${PILL_BUTTON} border-transparent bg-card shadow-md hover:bg-card dark:border-transparent dark:bg-card dark:hover:bg-accent`;
