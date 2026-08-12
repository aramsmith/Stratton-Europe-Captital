# Local validation boundary

Run `npm run validate` from `app/` for local format, lint, type, build, test and contract checks.
This validation does not contact Azure, invoke models or promote a benchmark.

Model-portfolio benchmark records are evidence input only. The template retains
`REQUIRED_OWNER_INPUT` for deployment capacity, embedding dimensions, chunking parameters, owner
IDs and evidence IDs. `text-embedding-3-large` dimensions or chunking changes require owner
benchmark evidence and an index rebuild. Deterministic numerical rules and Isolation Forest are the
initial explainable anomaly approach; supervised challengers remain future and evidence-gated.
