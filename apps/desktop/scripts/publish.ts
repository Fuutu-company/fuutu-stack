/**
 * Publishes a signed desktop release to the releases bucket — the last CI
 * step (`.github/workflows/desktop.yml`), or by hand (apps/desktop/RELEASING.md):
 *
 *   pnpm -F @fuutu/desktop-app exec tsx scripts/publish.ts \
 *     --dir <artifacts> [--channel stable] [--version 1.2.0] \
 *     [--notes-file notes.md] [--public-base https://cdn…] [--dry-run]
 *
 * `--dir` holds one directory per build job (`macos-universal`,
 * `windows-x86_64`, `linux-x86_64`) with that job's `bundle/` output.
 * Uploads every file first and `<channel>/latest.json` last, so a running
 * app never sees a manifest whose files are missing.
 *
 * S3-compatible storage only (S3, R2, MinIO, …): S3_ENDPOINT, S3_REGION,
 * S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE,
 * S3_BUCKET_DESKTOP_RELEASES (default `desktop-releases`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DESKTOP_CHANNELS, desktopConfig } from "@fuutu/desktop/config";
import { manifestKey } from "@fuutu/desktop/updates";
import {
	findRoot,
	readDotEnv,
	readProject,
	slotEnv,
} from "../../../tooling/ports/index.mjs";
import {
	isBuildJob,
	type JobFiles,
	planRelease,
	withPublicUrls,
} from "./lib/release";

const { values } = parseArgs({
	options: {
		dir: { type: "string" },
		channel: { type: "string", default: "stable" },
		version: { type: "string" },
		"notes-file": { type: "string" },
		"public-base": { type: "string" },
		"dry-run": { type: "boolean", default: false },
	},
});

function fail(message: string): never {
	process.stderr.write(`publish: ${message}\n`);
	process.exit(1);
}

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

const root = findRoot();
const env: NodeJS.ProcessEnv = { ...readDotEnv(root), ...process.env };
// Local runs: the port slot's bucket names (`s<slot>-…`), as apps/saas sees them.
const project = process.env.CI ? null : readProject(root);
if (project) Object.assign(env, slotEnv(project, env));
if (!values.dir) fail("--dir is required");
const channel = values.channel ?? "stable";
if (!(DESKTOP_CHANNELS as readonly string[]).includes(channel)) {
	fail(`unknown channel "${channel}" (${DESKTOP_CHANNELS.join(", ")})`);
}
if (desktopConfig.updates.source === "static" && !values["public-base"]) {
	// The app downloads `url` itself — it has to be absolute and public.
	fail(
		'updates.source is "static": pass --public-base <public URL of the bucket>',
	);
}
const version =
	values.version ??
	(
		JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
			version: string;
		}
	).version;

const jobs: JobFiles[] = readdirSync(values.dir)
	.filter((name) => statSync(join(values.dir!, name)).isDirectory())
	.map((name) => {
		if (!isBuildJob(name)) fail(`unknown build job directory "${name}"`);
		const jobDir = join(values.dir!, name);
		const files = walk(jobDir).map((f) => relative(jobDir, f));
		const signatures = Object.fromEntries(
			files
				.filter((f) => f.endsWith(".sig"))
				.map((f) => [f.slice(0, -4), readFileSync(join(jobDir, f), "utf8")]),
		);
		return { job: name, files, signatures };
	});

let plan: ReturnType<typeof planRelease>;
try {
	plan = planRelease({
		version,
		channel,
		notes: values["notes-file"]
			? readFileSync(values["notes-file"], "utf8").trim()
			: undefined,
		pubDate: new Date().toISOString(),
		jobs,
	});
} catch (err) {
	fail(err instanceof Error ? err.message : String(err));
}
const manifest = values["public-base"]
	? withPublicUrls(plan.manifest, values["public-base"])
	: plan.manifest;

const bucket = env.S3_BUCKET_DESKTOP_RELEASES || "desktop-releases";
for (const upload of plan.uploads) {
	process.stdout.write(
		`  ${upload.job}/${upload.file} → ${bucket}/${upload.key}\n`,
	);
}
process.stdout.write(
	`  manifest → ${bucket}/${manifestKey(channel as never)}\n`,
);
if (values["dry-run"]) {
	process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
	process.exit(0);
}

if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
	fail("S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are not set");
}
const s3 = new S3Client({
	region: env.S3_REGION || "us-east-1",
	...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
	forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
	credentials: {
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
	},
});

for (const upload of plan.uploads) {
	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: upload.key,
			Body: readFileSync(join(values.dir, upload.job, upload.file)),
			ContentType: "application/octet-stream",
		}),
	);
}
await s3.send(
	new PutObjectCommand({
		Bucket: bucket,
		Key: manifestKey(channel as never),
		Body: JSON.stringify(manifest),
		ContentType: "application/json",
		CacheControl: "no-cache",
	}),
);
process.stdout.write(`published ${version} to ${channel}\n`);
