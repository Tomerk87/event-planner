# services

- `contracts/` — the typed service interfaces pages depend on, and `servicesContract.ts`, the test suite any provider must pass (run on the demo by `npm test`, on the real API by `npm run test:api`).
- `mock/` — the browser-local demo: seeded generator, stored state, persistence adapter, the services and the demo backend.
- `api/` — the real application: HTTP client, the services over the API, sign-up and sign-in.
- `createServices.ts` — builds the application's one backend from the demo (if `VITE_DEMO_ENABLED`) and the API; a session belongs to one of them.
- `preferences.ts`, `spreadsheets.ts` — display preferences and browser file handling, shared by both.
- `servicesContext.ts`, `queries.ts` — how components reach the services.

Presentation components use these contracts and never call `fetch` or browser storage directly.
