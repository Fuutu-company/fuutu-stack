/** A job's block from a GitHub workflow (jobs sit at two-space indent). */
export function workflowJob(workflow: string, name: string): string {
	const start = workflow.indexOf(`\n  ${name}:\n`);
	if (start === -1) return "";
	const rest = workflow.slice(start + 1);
	const next = rest.slice(1).search(/\n {2}[\w-]+:\n/);
	return next === -1 ? rest : rest.slice(0, next + 1);
}
