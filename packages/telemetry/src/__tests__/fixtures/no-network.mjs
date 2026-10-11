// Fetch guard for ping-bin.test.ts — loaded via `node --import` before
// bin/ping.mjs. If the ping script ever attempts a network call, this
// kills the process with a distinct exit code so the test catches it.
globalThis.fetch = () => {
	process.stderr.write("network attempt detected\n");
	process.exit(42);
};
