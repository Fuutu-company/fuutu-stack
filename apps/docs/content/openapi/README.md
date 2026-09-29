# OpenAPI specs

`example.json` is a placeholder so the docs template renders API pages out of the box. To document the real kit API, point `input` in `src/lib/openapi.ts` at the spec the saas app serves — the oRPC `OpenAPIHandler` exposes it at `/api/spec.json`:

```ts
export const openapi = createOpenAPI({
	input: ["http://localhost:3000/api/spec.json"],
});
```

`input` also accepts local file paths or a `SchemaRecord` (multiple named specs).
