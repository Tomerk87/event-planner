# services

Typed service contracts for each feature, and the providers that implement them (browser-local mock provider, HTTP API provider). The provider is selected once at the application boundary from `VITE_DATA_PROVIDER`; see `providerConfig.ts`.

Presentation components use these contracts and never call `fetch` or browser storage directly.
