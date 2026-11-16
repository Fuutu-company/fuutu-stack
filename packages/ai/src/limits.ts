/**
 * Spend guardrails shared by the providers and `aiConfig` — kept free of
 * env imports so providers stay constructible in tests.
 */

/** Reply cap when neither the caller nor `aiConfig.maxOutputTokens` sets one. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

/** Prompt cap (characters across all messages) for user-facing AI routes. */
export const DEFAULT_MAX_PROMPT_CHARS = 32_000;
