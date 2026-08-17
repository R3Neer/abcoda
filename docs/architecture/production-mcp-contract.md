# Production MCP contract invariants

ABCoda production has one canonical MCP generation and one canonical Cloudflare deployment path.

## Tool surface

The public MCP server exposes exactly:

- `prepare_composition`
- `validate_score`
- `render_score`

`validate_score` accepts ABC and returns a schema-version-2 score snapshot. `render_score` accepts that schema-version-2 snapshot (plus optional presentation preferences) and must not expose the retired schema-version-1 direct-ABC request shape.

A production verification probe calls `tools/list` twice, requires identical definitions, checks the exact tool set, and rejects retired `render_score` properties such as `abc`, `composition`, `playback`, `notation`, and `display`.

Schema v1 is not a compatibility layer in the current source tree. Its contracts, server, widget, Worker entry point, deploy configuration and implementation-specific tests have been removed. Historical rollback or investigation must use Git history rather than dormant deployable code.

## Deployment

The only production Wrangler configuration is `apps/worker/wrangler.jsonc`, targeting the Cloudflare Worker named `abcoda`.

The former root `wrangler.jsonc` and its retired `worker/index.ts` deployment path must not be reintroduced. `npm run deploy:worker` is the canonical CLI deployment command and must explicitly use `apps/worker/wrangler.jsonc`.

This invariant prevents an old MCP generation from overwriting the current Worker while retaining the same public URL.
