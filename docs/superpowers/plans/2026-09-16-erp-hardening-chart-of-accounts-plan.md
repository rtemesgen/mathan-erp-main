# ERP Hardening and Chart of Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Mathan ERP's multi-business accounting boundaries and implement a backend-owned, four-digit chart of accounts that the frontend can render safely.

**Architecture:** Keep the existing Spring Boot/JdbcClient/PostgreSQL architecture, but move accounting rules into focused backend services instead of generic SQL paths. Add additive Flyway migrations, validate every cross-table reference against the active business, make voucher state transitions transactional, and expose chart metadata through the existing master API. Repair only the frontend flows that currently violate the backend contract.

**Tech Stack:** Java 21, Spring Boot 3.5, JdbcClient, PostgreSQL 17, Flyway, JUnit 5, Testcontainers PostgreSQL, React 19, TypeScript, Vite, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-16-erp-hardening-chart-of-accounts-design.md`

## Global Constraints

- Account ranges are `1000–1999` Assets, `2000–2999` Income, `3000–3999` Expenses, `4000–4999` Liabilities, and `5000–5999` Equity.
- Expense subranges are `3100–3199` COGS/direct costs, `3200–3899` operating expenses, and `3900–3999` other expenses/adjustments.
- The backend is authoritative for `businessId`, actor, voucher number, status, and timestamps.
- Every referenced entity must belong to the active business; active-only references must also be active.
- A cancelled voucher cannot be edited or cancelled a second time.
- Existing historical data must remain readable and must not receive duplicate default accounts.
- The frontend must not present an action as successful when no backend operation exists.
- All implementation behavior is test-first: write a failing test, observe the expected failure, implement the smallest passing change, then run the full relevant test set.

## File map before implementation

Create focused backend units:

- `mathan-backend/src/main/java/com/mathan/erp/chart/ChartOfAccounts.java`: immutable account-class ranges, normal balances, code validation, and default account definitions.
- `mathan-backend/src/main/java/com/mathan/erp/chart/ChartService.java`: chart bootstrap/backfill and ledger metadata lookup.
- `mathan-backend/src/main/java/com/mathan/erp/validation/ReferenceIntegrityService.java`: same-business and active-reference checks.
- `mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherValidationService.java`: voucher type, amount, period, currency, line, bill, and stock invariants.
- `mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherNumberService.java`: locked per-business/type numbering.

Modify existing backend boundaries:

- `mathan-backend/src/main/resources/db/migration/V3__chart_of_accounts.sql`: account code, parent account, constraints, and legacy backfill.
- `mathan-backend/src/main/resources/db/migration/V4__voucher_number_counters.sql`: concurrency-safe numbering state.
- `BusinessController.java`, `MasterService.java`, `VoucherService.java`, `ReportController.java`, `UserController.java`, `ApiErrorHandler.java`.
- `V1__initial_schema.sql` only if a fresh-install constraint must be corrected; do not rewrite applied migrations.

Create backend tests:

- `chart/ChartOfAccountsTest.java`
- `chart/ChartServiceIntegrationTest.java`
- `validation/ReferenceIntegrityIntegrationTest.java`
- `voucher/VoucherValidationIntegrationTest.java`
- `voucher/VoucherLifecycleIntegrationTest.java`
- `voucher/VoucherNumberIntegrationTest.java`
- `user/UserAuthorizationIntegrationTest.java`
- `report/ReportIntegrationTest.java`

Modify frontend contracts and flows:

- `mathan-frontend/src/types.ts`
- `mathan-frontend/src/lib/restStore.ts`
- `mathan-frontend/src/hooks/useAuth.tsx`
- `mathan-frontend/src/hooks/useBusiness.tsx`
- `mathan-frontend/src/components/masters/LedgersTab.tsx`
- `mathan-frontend/src/components/transactions/StockAdjustmentForm.tsx`
- `mathan-frontend/src/components/transactions/StockTransferForm.tsx`
- `mathan-frontend/src/components/transactions/PayrollForm.tsx`
- `mathan-frontend/src/components/masters/PeriodsTab.tsx`
- `mathan-frontend/src/components/Settings.tsx`
- `mathan-frontend/src/components/ReportCenter.tsx`
- `mathan-frontend/tests/accounting-real-data.spec.ts`

### Task 1: Add the chart-of-accounts schema and code rules

**Files:**
- Create: `mathan-backend/src/main/resources/db/migration/V3__chart_of_accounts.sql`
- Create: `mathan-backend/src/main/java/com/mathan/erp/chart/ChartOfAccounts.java`
- Test: `mathan-backend/src/test/java/com/mathan/erp/chart/ChartOfAccountsTest.java`

**Interfaces:**
- Produce `ChartOfAccounts.classify(String accountCode) -> AccountClass`.
- Produce `ChartOfAccounts.validate(String accountCode, AccountNature nature) -> void`.
- Produce `ChartOfAccounts.normalBalance(AccountNature nature, String accountCode) -> NormalBalance`.
- Produce `ChartOfAccounts.defaults() -> List<DefaultAccount>`.

- [ ] **Step 1: Write failing unit tests for the five ranges and invalid codes.** Assert that `2100` is Income/Cr, `3100` is Expense/Dr, `4100` is Liability/Cr, `5100` is Equity/Cr, `1100` is Asset/Dr, and codes outside `1000–5999`, non-four-digit strings, and nature/range mismatches throw a domain exception. Assert that `5300` (Drawings) returns Debit as its explicit exception.
- [ ] **Step 2: Run the focused test and verify it fails because `ChartOfAccounts` does not exist.** Run `./mvnw -q -Dtest=ChartOfAccountsTest test` from `mathan-backend`; expected result is a compilation failure naming the missing class or methods.
- [ ] **Step 3: Implement the immutable range model and default account list.** Use enum values `ASSET`, `INCOME`, `EXPENSE`, `LIABILITY`, `EQUITY`; map them to the specified ranges and normal balances; encode the Drawings exception by code `5300`; define the 20 default accounts from the spec, including `3600 Depreciation Expense`, with code, name, group name, nature, and system flag.
- [ ] **Step 4: Add the additive migration.** Add nullable `ledger.account_code`, nullable `ledger.parent_ledger_id`, a unique index on `(business_id, account_code)`, a four-character digit check, a same-business parent check in service code, and a backfill that assigns the specified codes to known legacy names and deterministic unused codes by nature to remaining legacy ledgers before making `account_code` non-null. Add indexes for code and parent lookups.
- [ ] **Step 5: Run the focused unit test and migration validation.** Run `./mvnw -q -Dtest=ChartOfAccountsTest test`; then run `./mvnw -q test` to ensure Flyway validates the complete migration chain.
- [ ] **Step 6: Commit the schema/rules checkpoint with `git add mathan-backend/src/main/resources/db/migration/V3__chart_of_accounts.sql mathan-backend/src/main/java/com/mathan/erp/chart/ChartOfAccounts.java mathan-backend/src/test/java/com/mathan/erp/chart/ChartOfAccountsTest.java && git commit -m "feat: add chart of accounts rules"`.**

### Task 2: Make business creation seed an idempotent detailed chart

**Files:**
- Create: `mathan-backend/src/main/java/com/mathan/erp/chart/ChartService.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/tenant/BusinessController.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/master/MasterService.java`
- Test: `mathan-backend/src/test/java/com/mathan/erp/chart/ChartServiceIntegrationTest.java`

**Interfaces:**
- `ChartService.seedDefaults(UUID businessId) -> ChartSeedResult`.
- `ChartService.list(UUID businessId) -> List<Map<String,Object>>`.
- Ledger responses include `accountCode`, `parentLedgerId`, `groupName`, `nature`, and `normalBalance`.

- [ ] **Step 1: Write failing integration tests.** Create a business, assert the exact default code/name/nature mapping, assert every ledger has a code, call `seedDefaults` twice and assert no duplicates, and create a custom ledger with code `2120` to prove valid extensions remain allowed.
- [ ] **Step 2: Run the test against PostgreSQL and verify the expected missing-schema/bootstrap failure.** Run `./mvnw -q -Dtest=ChartServiceIntegrationTest test`; if Docker/Testcontainers is unavailable, record that exact environment failure and run the unit portions locally.
- [ ] **Step 3: Implement `ChartService` using the default definitions from `ChartOfAccounts`.** Insert groups by `(business_id,name)` when absent, insert ledgers by `(business_id,account_code)` when absent, and return conflicts rather than replacing an existing account with a different name.
- [ ] **Step 4: Replace inline bootstrap SQL in `BusinessController.create` with `ChartService.seedDefaults`.** Keep business/currency/membership creation in one transaction and make chart seeding occur after the business and groups exist.
- [ ] **Step 5: Extend `MasterService.list/create/update` for ledger metadata and code validation.** For ledger writes, require `accountCode`, validate it against the selected group nature, validate parent ownership, and prevent changing a system account's code.
- [ ] **Step 6: Run unit and integration tests, then verify the ledger JSON contract.** Use `./mvnw -q -Dtest='ChartOfAccountsTest,ChartServiceIntegrationTest' test` and inspect the response assertion for `accountCode`, `nature`, and `normalBalance`.
- [ ] **Step 7: Commit with `git add mathan-backend/src/main/java/com/mathan/erp/chart mathan-backend/src/main/java/com/mathan/erp/tenant/BusinessController.java mathan-backend/src/main/java/com/mathan/erp/master/MasterService.java mathan-backend/src/test/java/com/mathan/erp/chart && git commit -m "feat: seed detailed chart of accounts"`.**

### Task 3: Enforce same-business reference integrity

**Files:**
- Create: `mathan-backend/src/main/java/com/mathan/erp/validation/ReferenceIntegrityService.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/master/MasterService.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/tenant/BusinessController.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherService.java`
- Test: `mathan-backend/src/test/java/com/mathan/erp/validation/ReferenceIntegrityIntegrationTest.java`

**Interfaces:**
- `requireGroup(UUID businessId, UUID id, boolean active) -> void`.
- `requireLedger(UUID businessId, UUID id, boolean active) -> void`.
- `requireCurrency(UUID businessId, UUID id, boolean active) -> void`.
- `requireParty(UUID businessId, UUID id, boolean active) -> void`.
- `requireUnit(UUID businessId, UUID id, boolean active) -> void`.
- `requireWarehouse(UUID businessId, UUID id, boolean active) -> void`.
- `requireProduct(UUID businessId, UUID id, boolean active) -> void`.
- `requireCostCenter(UUID businessId, UUID id, boolean active) -> void`.

- [ ] **Step 1: Write failing isolation tests.** Create two businesses and attempt cross-business ledger group, parent ledger, party ledger, product unit, base currency, voucher currency/party/ledger/cost center, and stock product/warehouse/unit references. Assert stable `REFERENCE_OUTSIDE_BUSINESS` or `REFERENCE_INACTIVE` errors and no partial rows.
- [ ] **Step 2: Run the focused test and verify it exposes the current authorization gap.** Run `./mvnw -q -Dtest=ReferenceIntegrityIntegrationTest test`; expected failures are current inserts succeeding or raw database errors.
- [ ] **Step 3: Implement one parameterized reference validator.** Query each table with both `id=:id` and `business_id=:businessId`, apply `active` when requested, and throw `ApiException(HttpStatus.BAD_REQUEST, ...)` with the stable error code.
- [ ] **Step 4: Call the validator before every master foreign-key write and every voucher/stock write.** Validate all IDs before the first insert/update so the transaction fails before any partial mutation.
- [ ] **Step 5: Add database constraints where the current schema safely supports them.** Add same-business composite uniqueness/FK constraints in a follow-up migration only after the integration tests prove existing data is clean; retain service checks as the user-facing error layer.
- [ ] **Step 6: Run the focused test and all backend tests.** Run `./mvnw -q -Dtest=ReferenceIntegrityIntegrationTest test` and `./mvnw -q test`.
- [ ] **Step 7: Commit with `git add mathan-backend/src/main/java/com/mathan/erp/validation mathan-backend/src/main/java/com/mathan/erp/master/MasterService.java mathan-backend/src/main/java/com/mathan/erp/tenant/BusinessController.java mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherService.java mathan-backend/src/test/java/com/mathan/erp/validation && git commit -m "fix: enforce tenant reference integrity"`.**

### Task 4: Centralize strict voucher validation and safe numbering

**Files:**
- Create: `mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherValidationService.java`
- Create: `mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherNumberService.java`
- Create: `mathan-backend/src/main/resources/db/migration/V4__voucher_number_counters.sql`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherService.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/api/ApiErrorHandler.java`
- Test: `mathan-backend/src/test/java/com/mathan/erp/voucher/VoucherValidationIntegrationTest.java`
- Test: `mathan-backend/src/test/java/com/mathan/erp/voucher/VoucherNumberIntegrationTest.java`

**Interfaces:**
- `VoucherValidationService.validateForPost(UUID businessId, JsonNode body, Membership membership) -> ValidatedVoucher`.
- `VoucherNumberService.next(UUID businessId, String voucherType) -> String`.
- Stable errors: `INVALID_VOUCHER_TYPE`, `PERIOD_REQUIRED`, `PERIOD_CLOSED`, `UNBALANCED_VOUCHER`, `INVALID_AMOUNT`, `INVALID_EXCHANGE_RATE`, and `INVALID_VOUCHER_REFERENCE`.

- [ ] **Step 1: Write failing validation tests.** Cover unknown type, missing period, closed period, empty financial lines, one-sided/zero/negative lines, unbalanced base amounts, non-positive exchange rates, invalid bill amounts, invalid stock quantities, and invalid references.
- [ ] **Step 2: Run the focused test and verify failures are caused by currently permissive behavior or generic 500s.** Run `./mvnw -q -Dtest=VoucherValidationIntegrationTest test`.
- [ ] **Step 3: Implement `VoucherValidationService`.** Define the allowed voucher types from `VoucherType`, require an open period containing the date, require at least two financial lines unless the type is stock-only, enforce exactly one positive debit or credit per line, compare base debit and credit totals, and validate stock/bill fields.
- [ ] **Step 4: Write the failing concurrency test.** Start multiple transactions for the same business/type and assert all returned numbers are unique and match the stable prefix format.
- [ ] **Step 5: Implement `V4__voucher_number_counters.sql` and `VoucherNumberService`.** Create `voucher_number_counter(business_id,type,last_number,primary key(business_id,type))`; use `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING last_number` inside the posting transaction; preserve existing voucher numbers during edits.
- [ ] **Step 6: Map constraint/data errors to stable API errors.** Handle `DataIntegrityViolationException`, malformed UUID/date/decimal input, and duplicate number errors without exposing SQL details.
- [ ] **Step 7: Run focused and complete tests.** Run `./mvnw -q -Dtest='VoucherValidationIntegrationTest,VoucherNumberIntegrationTest' test` and `./mvnw -q test`.
- [ ] **Step 8: Commit with `git add mathan-backend/src/main/java/com/mathan/erp/voucher mathan-backend/src/main/resources/db/migration/V4__voucher_number_counters.sql mathan-backend/src/main/java/com/mathan/erp/api/ApiErrorHandler.java mathan-backend/src/test/java/com/mathan/erp/voucher && git commit -m "fix: validate vouchers and number them safely"`.**

### Task 5: Correct voucher lifecycle and user/settings authorization

**Files:**
- Modify: `mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherService.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/user/UserController.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/tenant/BusinessController.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/master/MasterService.java`
- Test: `mathan-backend/src/test/java/com/mathan/erp/voucher/VoucherLifecycleIntegrationTest.java`
- Test: `mathan-backend/src/test/java/com/mathan/erp/user/UserAuthorizationIntegrationTest.java`

**Interfaces:**
- `VoucherService.update` accepts only `Posted` vouchers and replaces stock effects once inside its transaction.
- `VoucherService.cancel` accepts only `Posted` vouchers and returns `VOUCHER_ALREADY_CANCELLED` for repeats.
- Settings updates accept `name`, `baseCurrencyId`, and `allowNegativeInventory` only after active-business permission validation.
- User updates first verify target membership in the active business, then update the global profile.

- [ ] **Step 1: Write failing lifecycle tests.** Post stock, cancel once, assert quantity rollback; cancel again and assert a conflict with unchanged quantity; attempt edit after cancellation and assert rejection; edit a posted stock voucher and assert old stock is rolled back exactly once before new stock is applied.
- [ ] **Step 2: Write failing authorization tests.** Assert a user cannot update another business's user profile/PIN, cannot change another business's name/settings, and cannot close a period without settings permission.
- [ ] **Step 3: Implement status guards and exact rollback.** Lock the voucher row with `FOR UPDATE`, require status `Posted`, aggregate stock movements per product/warehouse during rollback, update balances once, delete old movements/lines only after validation, and preserve the posted status on a valid edit.
- [ ] **Step 4: Implement period state endpoints.** Add `PATCH /api/v1/masters/periods/{id}` with same-business validation, date checks, and audit logging; expose close/open as updates to `closed` and prevent changing a closed period's dates.
- [ ] **Step 5: Extend settings update to persist business name.** Validate trimmed name length and update only the active business selected by `X-Business-Id`.
- [ ] **Step 6: Protect target-user updates.** Require the target membership before changing `app_user`; validate role against the database allowlist; prevent removal/deactivation of the last active admin.
- [ ] **Step 7: Run lifecycle, authorization, and full backend tests.** Run `./mvnw -q -Dtest='VoucherLifecycleIntegrationTest,UserAuthorizationIntegrationTest' test` and `./mvnw -q test`.
- [ ] **Step 8: Commit with `git add mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherService.java mathan-backend/src/main/java/com/mathan/erp/user/UserController.java mathan-backend/src/main/java/com/mathan/erp/tenant/BusinessController.java mathan-backend/src/main/java/com/mathan/erp/master/MasterService.java mathan-backend/src/test/java/com/mathan/erp/voucher mathan-backend/src/test/java/com/mathan/erp/user && git commit -m "fix: make voucher lifecycle and admin changes safe"`.**

### Task 6: Make backend reports authoritative and chart-aware

**Files:**
- Modify: `mathan-backend/src/main/java/com/mathan/erp/report/ReportController.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherService.java`
- Test: `mathan-backend/src/test/java/com/mathan/erp/report/ReportIntegrationTest.java`

**Interfaces:**
- Report endpoints accept optional `from`, `to`, `currencyId`, `page`, and `size` parameters where applicable.
- Trial balance rows return `accountCode`, `ledgerName`, `groupName`, `nature`, `normalBalance`, opening balance, debit, credit, and closing balance.
- Stock rows return quantity and a clearly labelled `valuationBasis` of `PROVISIONAL_SELLING_PRICE` until costing is implemented.

- [ ] **Step 1: Write failing report tests.** Assert cancelled vouchers are excluded, date filters work, trial balance rows include account code/normal balance, outstanding bill allocations net by reference type, and stock summary does not claim selling price is cost.
- [ ] **Step 2: Run the focused report test and verify current response/logic failures.** Run `./mvnw -q -Dtest=ReportIntegrationTest test`.
- [ ] **Step 3: Implement server-side filtering and pagination.** Move report queries to parameterized SQL with business/date/status filters and stable ordering; add account joins for metadata.
- [ ] **Step 4: Implement bill-wise aggregation from `bill_allocation`.** Treat `New Ref` as an increase, `Against Ref` as a settlement, and reject allocations that exceed the referenced open amount.
- [ ] **Step 5: Add report integration tests and run all backend tests.** Run `./mvnw -q -Dtest=ReportIntegrationTest test` and `./mvnw -q test`.
- [ ] **Step 6: Commit with `git add mathan-backend/src/main/java/com/mathan/erp/report/ReportController.java mathan-backend/src/test/java/com/mathan/erp/report && git commit -m "feat: expose authoritative chart-aware reports"`.**

### Task 7: Repair frontend contract and edit/settings flows

**Files:**
- Modify: `mathan-frontend/src/types.ts`
- Modify: `mathan-frontend/src/lib/restStore.ts`
- Modify: `mathan-frontend/src/hooks/useAuth.tsx`
- Modify: `mathan-frontend/src/hooks/useBusiness.tsx`
- Modify: `mathan-frontend/src/components/masters/LedgersTab.tsx`
- Modify: `mathan-frontend/src/components/transactions/StockAdjustmentForm.tsx`
- Modify: `mathan-frontend/src/components/transactions/StockTransferForm.tsx`
- Modify: `mathan-frontend/src/components/transactions/PayrollForm.tsx`
- Modify: `mathan-frontend/src/components/masters/PeriodsTab.tsx`
- Modify: `mathan-frontend/src/components/Settings.tsx`
- Modify: `mathan-frontend/src/components/ReportCenter.tsx`
- Test: `mathan-frontend/tests/accounting-real-data.spec.ts`

**Interfaces:**
- `Ledger` exposes `accountCode`, `groupName`, `nature`, `normalBalance`, and `parentLedgerId`.
- REST adapter update paths use the backend's actual period/settings/voucher endpoints.
- Reports request backend report data instead of deriving statements from the complete voucher array.

- [ ] **Step 1: Add failing Playwright assertions.** Assert a ledger code is visible in master data, period close/open changes state, business name save persists after reload, stock adjustment/transfer/payroll edit does not increase voucher count, and logout clears the business header.
- [ ] **Step 2: Run the focused E2E test against a running stack and verify the new assertions fail on current behavior.** Run `BASE_URL=http://localhost:3000 npx playwright test tests/accounting-real-data.spec.ts --project=chromium`; if the stack is unavailable, keep the failure as an environment prerequisite and use TypeScript checks for local validation.
- [ ] **Step 3: Update frontend types and ledger rendering.** Add chart fields and render code/group metadata without duplicating range logic.
- [ ] **Step 4: Fix edit flows.** In stock adjustment, stock transfer, and payroll forms, call `updateDoc` with the existing voucher ID when `editVoucher` is present; preserve the existing number and pass complete replacement data.
- [ ] **Step 5: Fix settings and period controls.** Wire business name save to the settings endpoint, wire period edit/open/close to the backend, and remove/disable any action without a real operation.
- [ ] **Step 6: Fix lifecycle state.** Make logout clear business context, unsubscribe nested currency listeners, and prevent stale business data from rendering after user changes.
- [ ] **Step 7: Switch reports to backend endpoints incrementally.** Keep existing components for presentation, map server report rows into their props, and preserve export functionality using the filtered server result.
- [ ] **Step 8: Run `npm run lint`, `npm run build`, and the focused Playwright test.** Confirm TypeScript/build success and record any live-stack limitation separately from code failures.
- [ ] **Step 9: Commit with `git add mathan-frontend/src mathan-frontend/tests/accounting-real-data.spec.ts && git commit -m "fix: align frontend with hardened accounting APIs"`.**

### Task 8: Full verification, documentation, and release gate

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`
- Modify: `mathan-frontend/tests/accounting-real-data.spec.ts`
- Test: all backend and frontend test files from Tasks 1–7

- [ ] **Step 1: Add operational documentation.** Document the chart ranges, default accounts, migration behavior, required non-placeholder environment values, HTTPS/secure-cookie requirements, and backup/restore commands in `README.md`.
- [ ] **Step 2: Ignore generated test artifacts.** Add `mathan-frontend/playwright-report/`, `mathan-frontend/test-results/`, and any generated build output not already ignored to `.gitignore` without deleting existing user artifacts.
- [ ] **Step 3: Run backend verification.** Run `./mvnw test`; expected result is all unit/integration tests passing with no skipped accounting/security gates.
- [ ] **Step 4: Run frontend verification.** Run `npm run lint` and `npm run build`; expected result is both passing. Run Playwright against Docker Compose when Docker access is available.
- [ ] **Step 5: Run a manual API security smoke test.** With two businesses and two users, verify cross-business references return domain errors, cancelled voucher mutation is rejected, account-code metadata is returned, and reports exclude cancelled rows.
- [ ] **Step 6: Review migration and API compatibility.** Confirm fresh database setup and upgrade from current schema both work, existing voucher IDs/numbers remain stable, and the frontend has no remaining unsupported REST-store operation.
- [ ] **Step 7: Commit the release checkpoint with `git add README.md .gitignore mathan-frontend/tests/accounting-real-data.spec.ts && git commit -m "docs: document accounting hardening and release checks"`.**

## Execution order and gates

Tasks must execute in order because later tasks consume earlier interfaces. Do not start Task 3 until Task 2 proves the chart migration/bootstrap works. Do not start frontend migration until backend report and lifecycle contracts have passing integration tests. The final completion claim requires both local static verification and a live PostgreSQL-backed E2E run; a frontend build alone is not sufficient evidence.
