# Business Onboarding Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make business creation, selection, retry, and switching atomic, recoverable, and permission-safe.

**Architecture:** The authorized business-list response becomes the source of the business and its base-currency details. A testable frontend context controller validates and prepares the selection before `BusinessProvider` persists it. The app updates actor permissions only after that controller reports success; the selector renders structured creation and open failures without duplicating requests.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner, Spring Boot 3.5, JUnit 5, MockMvc.

**Spec:** `docs/superpowers/specs/2026-10-06-business-onboarding-stability-design.md`

## Global Constraints

- A business becomes active only after membership and base-currency context are confirmed.
- A failed open must not persist `currentBusinessId`, update actor permissions, or render the dashboard.
- A newly created business is retained and is retryable; never delete it because initial opening failed.
- Switch business clears only the active business context, never the authenticated session.
- Supported onboarding currencies are exactly USD, UGX, KES, and SSP; the backend remains authoritative.
- A missing refresh cookie returns `401 INVALID_REFRESH_TOKEN`.

## Review Focus

- A restricted user without `masters` permission can still open an allowed business because base-currency details arrive with the business response; test in Task 1.
- A stale stored ID from a different user is cleared without a request carrying that ID; test in Task 3.
- A failed currency/context confirmation leaves local storage unchanged; test in Task 2.
- Repeated clicks while an open or create is running cause one request only; test in Task 4.
- A server-side `fieldErrors.name` remains displayed while preserving the user-entered name and currency; test in Task 4.

---

## File structure

- `mathan-backend/.../tenant/BusinessController.java`: returns complete base-currency context with authorized business records.
- `mathan-backend/.../security/AuthController.java`: handles no-cookie refresh consistently.
- `mathan-frontend/src/lib/businessContext.ts`: pure, testable prepare/commit selection controller.
- `mathan-frontend/src/lib/businessOnboarding.ts`: supported currencies and creation-error mapping.
- `mathan-frontend/src/hooks/useBusiness.tsx`: React adapter exposing atomic open and clear methods.
- `mathan-frontend/src/App.tsx`: applies actor membership only after an open succeeds.
- `mathan-frontend/src/components/BusinessManager.tsx`: retryable user interface for loading, opening, and creation errors.

### Task 1: Return self-contained authorized business context

**Files:**
- Modify: `mathan-backend/src/main/java/com/mathan/erp/tenant/BusinessController.java`
- Modify: `mathan-frontend/src/types.ts`
- Test: `mathan-backend/src/test/java/com/mathan/erp/security/AuthControllerTest.java`
- Create: `mathan-backend/src/test/java/com/mathan/erp/tenant/BusinessResponseTest.java`

**Interfaces:**
- Produces `Business.baseCurrency: { id, code, name, symbol, exchangeRate } | null` from `GET /api/v1/businesses` and create responses.
- Preserves the legacy `baseCurrencyId` and `baseCurrencyCode` fields during transition.

- [ ] Write a failing controller/mapping test asserting an authorized business response contains `baseCurrency` without invoking the masters API, and extend the refresh test for a missing cookie.
- [ ] Run `./mvnw -q -Dtest='BusinessResponseTest,AuthControllerTest' test`; verify the currency-context assertion fails before the response is extended.
- [ ] Add the currency fields to the authorized business query, map them into a nested base-currency object, and align the create response with that shape. Keep null base currencies explicit.
- [ ] Update the frontend `Business` type to model the nested currency context.
- [ ] Run the focused backend tests; expect all pass.
- [ ] Commit only the backend response/test and frontend type changes with `feat: return business base currency context`.

### Task 2: Build a testable atomic business-open controller

**Files:**
- Create: `mathan-frontend/src/lib/businessContext.ts`
- Create: `mathan-frontend/src/lib/businessContext.test.ts`

**Interfaces:**
- Produces `createBusinessContextController(deps)` with `openBusiness(id): Promise<OpenBusinessResult>`, `clearBusiness(): void`, and `retryOpenBusiness(): Promise<OpenBusinessResult>`.
- `OpenBusinessResult` is `{ ok: true; business: Business; currency: Currency | null } | { ok: false; code: 'OPEN_IN_PROGRESS' | 'BUSINESS_NOT_AVAILABLE' | 'BUSINESS_CONTEXT_UNAVAILABLE'; message: string }`.

- [ ] Write failing tests proving an open commits storage only after the allowed business and nested currency context are present; rejected/missing business leaves storage and active state empty; a retry can succeed after a prior failure; concurrent calls return `OPEN_IN_PROGRESS` without duplicate loading.
- [ ] Run `npm run test:unit`; verify the new controller tests fail because the module is absent.
- [ ] Implement the controller with injected `listBusinesses`, `storage`, and state callbacks. Treat `currentBusinessId` as a commit action, never an input authority.
- [ ] Run `npm run test:unit`; expect all unit tests pass.
- [ ] Commit controller and tests with `feat: make business opening atomic`.

### Task 3: Adapt React context and actor updates to confirmed opens

**Files:**
- Modify: `mathan-frontend/src/hooks/useBusiness.tsx`
- Modify: `mathan-frontend/src/hooks/useAuth.tsx`
- Modify: `mathan-frontend/src/App.tsx`
- Modify: `mathan-frontend/src/lib/api.ts`
- Test: `mathan-frontend/src/lib/businessSession.test.ts`

**Interfaces:**
- `useBusiness()` exposes `openBusiness(id): Promise<OpenBusinessResult>`, `clearBusiness(): void`, and existing `business`, `currency`, `isLoading`.
- API requests honor an explicitly supplied `X-Business-Id`; storage-derived headers fill only when that header is absent.

- [ ] Add failing tests for stale stored IDs and explicit request headers so a candidate business can be validated before storage is committed.
- [ ] Run `npm run test:unit`; verify failure against the current optimistic context behavior.
- [ ] Replace snapshot-based startup selection with the controller; hydrate only through `openBusiness`, clear failed candidates, and expose typed results.
- [ ] Change `AppContent.handleBusinessSelect` to call `openBusiness`, then update actor role and permissions only for a successful result. Use `clearBusiness` for logout and switch business.
- [ ] Run `npm run test:unit && npm run lint`; expect pass.
- [ ] Commit context/app/API changes with `fix: confirm business context before activation`.

### Task 4: Make onboarding recovery visible and retryable

**Files:**
- Create: `mathan-frontend/src/lib/businessOnboarding.ts`
- Create: `mathan-frontend/src/lib/businessOnboarding.test.ts`
- Modify: `mathan-frontend/src/components/BusinessManager.tsx`
- Modify: `mathan-frontend/src/components/Dashboard.tsx`

**Interfaces:**
- Exports `ONBOARDING_CURRENCIES`, `isSupportedOnboardingCurrency(code)`, and `mapBusinessCreateError(error): { name?: string; summary?: string }`.
- `BusinessManager.onSelect(id)` resolves `OpenBusinessResult` and exposes retry on an affected card.

- [ ] Write failing tests for the four supported currencies, rejection of an unsupported code, and structured `fieldErrors.name` mapping while preserving a fallback summary.
- [ ] Run `npm run test:unit`; verify the onboarding helper tests fail before implementation.
- [ ] Implement the shared onboarding module and use it in `BusinessManager`; client-validate currency before POST.
- [ ] Refactor `BusinessManager` so it retains form state on create failure, displays inline name/form errors, disables only the in-flight action, and shows **Retry opening** for the business whose open failed. Reset and close the form only on an `ok: true` result.
- [ ] Keep Dashboard's **Switch business** action and ensure it calls the clear-only operation.
- [ ] Run `npm run test:unit && npm run lint`; expect pass.
- [ ] Commit UI/helper/test changes with `fix: make business onboarding recoverable`.

### Task 5: Verify full behavior in browser and deployment build

**Files:**
- Modify: `mathan-frontend/tests/accounting-real-data.spec.ts`

**Interfaces:**
- Uses the existing Playwright stack and local backend credentials; no test-only production APIs.

- [ ] Extend the browser scenario to select a business, invoke **Switch business**, select a second business, and assert the dashboard returns only after each confirmed open.
- [ ] Add an API-failure interception scenario asserting the selector shows Retry rather than the empty state.
- [ ] Run `npm run test:e2e` against a rebuilt local stack; expect pass.
- [ ] Run `npm run test:unit && npm run lint && npm run build` and `./mvnw -q test`; expect no failures.
- [ ] Commit verification changes with `test: cover stable business onboarding`.

## Self-review

- Spec coverage: Tasks 1–5 cover every success criterion, the no-cookie contract, currency ownership, recovery, and browser behavior.
- Type consistency: Task 2 defines `OpenBusinessResult`; Tasks 3 and 4 consume the same type.
- Review focus: each listed failure condition is assigned a concrete test task.
- Scope: no backend activation endpoint, schema migration, or offline behavior is introduced.
