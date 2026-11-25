# services

- `contracts/` — the typed service interfaces pages depend on, and `servicesContract.ts`, the test suite any provider must pass (run on the demo by `npm test`, on the real API by `npm run test:api`).
- `mock/` — the browser-local demo: seeded generator (sample events per market, Israel and Brazil), stored state, persistence adapter, the demo's time limits (`demoClock.ts`), the services and the demo backend.
- `api/` — the real application: HTTP client, the services over the API, sign-up and sign-in, and the email links that need no session (`accountEmail`: features, forgot and reset password, verify email; D88). The demo has no email: its user counts as verified and its email and System operations answer NOT_FOUND. `noAccountsBackend.ts` stands in for the API in a demo-only build (`VITE_ACCOUNTS_ENABLED=false`) and sends no request.
- `createServices.ts` — builds the application's one backend from the demo (if `VITE_DEMO_ENABLED`) and the API (unless `VITE_ACCOUNTS_ENABLED=false`); a session belongs to one of them. `providerConfig.ts` reads and checks both switches.
- `preferences.ts`, `spreadsheets.ts` — display preferences and browser file handling, shared by both.
- `servicesContext.ts`, `queries.ts` — how components reach the services.

Presentation components use these contracts and never call `fetch` or browser storage directly.
