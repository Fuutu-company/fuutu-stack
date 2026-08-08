## Description

<!-- Brief description of what this PR does -->

## Type of Change

<!-- Check all that apply -->

- [ ] `feat:` — new feature (minor bump)
- [ ] `fix:` — bug fix (patch bump)
- [ ] `breaking:` — breaking change (major bump)
- [ ] `docs:` — documentation only
- [ ] `chore:` — tooling, deps, refactoring

## Related Issue

<!-- Link to issue: Closes #123, Fixes #456 -->

## Changes

<!-- List the key changes -->

-

## Checklist

- [ ] PR title follows [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `breaking:`, `docs:`, `chore:`)
- [ ] Branch targets `develop` (or `main` for hotfixes)
- [ ] `pnpm check` passes (lint + types + tests)
- [ ] No `console.log` — using `@fuutu/logs` for any new logging
- [ ] No hardcoded config — using `@fuutu/<domain>/config` or `@fuutu/config`
- [ ] All user-visible strings are i18n'd (`useTranslations()` / `getTranslations()`)
- [ ] All user input validated with Zod
- [ ] No new `any` types or `@ts-ignore`
- [ ] Tests added for new functionality
- [ ] No secrets, API keys, or credentials in the diff
- [ ] Provider interfaces used (no direct concrete provider imports)
