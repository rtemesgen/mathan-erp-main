# Validation, Error Messages, and Flow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make failed and incomplete ERP operations understandable, consistent, and safe across the frontend and backend.

**Architecture:** Keep the existing Sonner toast provider, but centralize API error-to-message conversion and make form submission report validation before network calls. Backend errors will preserve stable error codes and field-level details; frontend catches will show one actionable toast without rethrowing into unhandled UI errors.

**Tech Stack:** React, TypeScript, Sonner, Vite, Spring Boot, JdbcClient, JUnit 5.

**Spec:** Approved in-chat design for cross-cutting validation, toast, error, and flow hardening.

## Global Constraints

- Do not expose secrets or raw server stack traces in user-facing messages.
- Preserve the existing API error shape: `status`, `code`, `message`, optional `fieldErrors`.
- Every write form must prevent duplicate submits while its request is active.
- Required fields must be validated both in the browser and on the backend.
- Existing successful voucher, master, and authentication flows must remain compatible.

---

### Task 1: Central API error and toast behavior

**Files:**
- Modify: `mathan-frontend/src/lib/api.ts`
- Modify: `mathan-frontend/src/lib/data.ts`
- Modify: `mathan-frontend/src/context/UIContext.tsx`
- Test: `mathan-frontend/src/lib/api.test.ts`

**Interfaces:**
- Produce `getApiErrorMessage(error: unknown, fallback: string): string`.
- Produce `getApiFieldErrors(error: unknown): Record<string, string>`.
- `handleApiError` must log diagnostics and return a safe message rather than throw.

- [x] Write failing unit tests for an `ApiError` with a field error, a structured server error, and a network failure.
- [x] Run the focused test and confirm it fails because the helpers do not exist.
- [x] Implement the helpers and make `handleApiError` non-throwing.
- [x] Update toast usage so messages include the server’s actionable reason once.
- [x] Run the focused test and the frontend type check.

### Task 2: Required-field and duplicate-submit flow hardening

**Files:**
- Create: `mathan-frontend/src/lib/validation.ts`
- Modify: `mathan-frontend/src/components/transactions/*.tsx`
- Modify: `mathan-frontend/src/components/masters/*.tsx`
- Modify: `mathan-frontend/src/components/BusinessManager.tsx`
- Test: `mathan-frontend/src/lib/validation.test.ts`

**Interfaces:**
- Produce `required(value, label): string | undefined`.
- Produce `positiveNumber(value, label): string | undefined`.
- Produce `validateDateRange(start, end): string | undefined`.

- [x] Write failing tests for blank text, non-positive quantity/amount, and reversed date ranges.
- [x] Run the focused tests and confirm the expected failures.
- [x] Implement pure validation helpers.
- [x] Apply helpers to the highest-risk voucher forms (sale, purchase, finance, journal, stock adjustment, stock transfer, payroll), preserving existing form-specific checks.
- [x] Ensure each async submit sets and clears its submitting state in `finally` and reports server failures through one toast.
- [x] Apply required validation to master/business forms where HTML `required` does not catch whitespace or dependent fields.
- [x] Run frontend lint/build and focused tests.

### Task 3: Backend request validation and regression coverage

**Files:**
- Modify: `mathan-backend/src/main/java/com/mathan/erp/master/MasterService.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherValidationService.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/voucher/VoucherService.java`
- Modify: `mathan-backend/src/main/java/com/mathan/erp/api/ApiErrorHandler.java`
- Test: `mathan-backend/src/test/java/com/mathan/erp/voucher/VoucherValidationServiceTest.java`
- Test: `mathan-backend/src/test/java/com/mathan/erp/master/MasterServiceTest.java`

- [x] Add failing tests for missing voucher type/date/lines, zero monetary amounts, and whitespace master names.
- [x] Run focused Maven tests and confirm they fail for the missing invariants.
- [x] Implement stable `VALIDATION_ERROR`/`FIELD_VALIDATION_ERROR` responses without leaking SQL or stack traces.
- [x] Verify cross-business and closed-period errors remain distinct and actionable.
- [x] Run the full backend test suite and the opt-in PostgreSQL integration test.

### Task 4: End-to-end verification and handoff

- [x] Run `./mvnw test -q` in `mathan-backend`.
- [x] Run `npm run lint && npm run build` in `mathan-frontend`.
- [x] Exercise login, business creation, one invalid voucher, and one successful voucher in a browser.
- [x] Confirm no unhandled console errors and that the working tree contains no secrets or generated reports.
- [x] Update README with the validation/error contract if behavior changed.
