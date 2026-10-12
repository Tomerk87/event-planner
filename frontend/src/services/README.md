# services

- `contracts/` — the typed service interfaces pages depend on, and `servicesContract.ts`, the test suite any provider must pass.
- `mock/` — the browser-local demo provider: seeded generator, stored state, persistence adapter, and the services themselves.
- `createServices.ts` — builds the provider once, from `VITE_DATA_PROVIDER` (see `providerConfig.ts`).
- `servicesContext.ts`, `queries.ts` — how components reach the provider.

Presentation components use these contracts and never call `fetch` or browser storage directly.
