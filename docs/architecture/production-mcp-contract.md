# Production MCP contract invariants

ABCoda production has one canonical MCP generation and one canonical Cloudflare deployment path.

## Tool surface

The public MCP server exposes exactly:

- `prepare_composition`
- `validate_score`
- `render_score`

`validate_score` accepts ABC and returns a schema-version-2 score snapshot. `render_score` accepts that schema-version-2 snapshot (plus optional presentation preferences) and must not expose the legacy schema-version-1 direct-ABC request shape.

A production verification probe calls `tools/list` twice, requires identical definitions, checks the exact tool set, and rejects legacy `render_score` properties such as `abc`, `composition`, `playback`, `notation`, and `display`.

## Deployment

The only production Wrangler configuration is `apps/worker/wrangler.jsonc`, targeting the Cloudflare Worker named `abcoda`.

The former root `wrangler.jsonc` and its legacy `worker/index.ts` deployment path must not be reintroduced. `npm run deploy:worker` is the canonical CLI deployment command and must explicitly use `apps/worker/wrangler.jsonc`.

This invariant prevents an old MCP generation from overwriting the current Worker while retaining the same public URL.
