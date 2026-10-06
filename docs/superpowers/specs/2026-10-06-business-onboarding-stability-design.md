# Business Onboarding Stability Design

## Goal

Make selecting, creating, retrying, and switching businesses deterministic. A user must never enter a partially initialized business context. A failed open keeps the selector available and provides a targeted retry action.

## Scope

This design covers the React business selector, business context, authenticated actor state, client-side onboarding currency definition, and the existing refresh endpoint's no-cookie behavior. It does not add a new backend business-activation endpoint or change membership authorization rules.

## Success criteria

- A business becomes active only after it is confirmed accessible and its required base currency is loaded.
- Failed opens do not write `currentBusinessId`, do not update the actor's active role/permissions, and do not render the dashboard.
- A just-created business remains listed when opening fails and can be retried without being created again.
- List and creation failures preserve useful user input and provide actionable recovery.
- Switching business clears only the active business context; it retains the authenticated session.
- A refresh request without a cookie returns a stable unauthorized API response, not an internal server error.

## Architecture

### Business context is authoritative for an active business

`BusinessProvider` owns the selected ID, loaded business, and loaded base currency. It exposes:

- `openBusiness(id): Promise<OpenBusinessResult>`
- `clearBusiness(): void`
- `retryOpenBusiness(): Promise<OpenBusinessResult>` when an openable ID is retained for retry

`openBusiness` performs the following work in order:

1. Reject concurrent opens with a stable in-progress result.
2. Fetch the requested business through the authenticated `/businesses` list, which confirms current membership.
3. Load the selected business's base currency when one is configured.
4. Commit the business, currency, and persisted `currentBusinessId` only after all required data is available.
5. On any failure, clear transient business state and leave persisted selection empty. Return a typed failure with a retry-safe message.

The provider never derives an active business from browser storage alone. Stored selection is treated as a candidate and must pass the same membership and data-loading checks.

### App coordinates actor state after context confirmation

`AppContent` requests `openBusiness` and waits for success before applying the selected membership's role and permissions to the actor. It clears the context through `clearBusiness` for logout, stale membership, and the dashboard's Switch business action.

This removes the current optimistic sequence where the actor and local storage change before data has been verified.

### Business selector owns retryable user interactions

`BusinessManager` owns the presentation state for:

- initial list loading;
- list failure and retry;
- create-form validation and field errors;
- business opening in progress;
- an opening failure keyed to one business;
- retrying a newly created or existing business.

It receives an `onSelect` operation that resolves to an explicit success/failure result, not an exception swallowed by `App`. A card is disabled only while an open is in progress. When opening fails, the affected card remains selectable and shows **Retry opening**.

After a successful creation, the selector inserts the returned business into its list and attempts to open it. It resets the form and closes the dialog only when that open succeeds. If it fails, the dialog closes to expose the new card and its retry action; no duplicate create call is made.

## Error handling

The existing structured API error body remains the contract: `status`, `code`, `message`, and optional `fieldErrors`.

- A business-list failure shows a dedicated retry panel rather than the empty state.
- Creation preserves the name and selected currency. `fieldErrors.name` renders beneath the name input; any other server error renders in the form summary.
- An open failure returns a non-sensitive failure message and does not produce a global "environment loaded" success toast.
- A successful open produces the success toast once, after the context is committed.
- `POST /api/v1/auth/refresh` with no `mathan_refresh` cookie responds with `401 INVALID_REFRESH_TOKEN`; the client treats it as an unauthenticated state, not a system failure.

## Currency contract

Supported onboarding currencies are defined once in a shared frontend module: USD, UGX, KES, and SSP. The selector renders that definition and validates that the selected code remains in it. The backend remains authoritative and rejects unsupported codes.

## Test plan

### Frontend unit tests

- Stored selection resolves only when the authenticated memberships include it.
- `openBusiness` commits business, currency, and storage only after successful loads.
- Missing membership, business load failure, and currency load failure leave no active selection.
- Retrying an open after a failure can succeed.
- Repeated select or create commands while one is in progress do not issue duplicate operations.
- Creation failure preserves form state and maps structured field errors to the correct field.

### Backend controller test

- Refreshing without a cookie returns HTTP 401 and `INVALID_REFRESH_TOKEN`.

### Browser verification

- Login reaches Active Entities without an error overlay.
- A user can create or select a business, use Switch business from the dashboard, and select another available business.
- A failed business-list or open request presents a retry state without displaying a false empty state.

## Non-goals

- Automatic selection of a user's only business.
- Deleting a business when initial opening fails.
- Changing the backend's business/membership schema.
- Introducing offline caching or real-time subscriptions for business membership.
