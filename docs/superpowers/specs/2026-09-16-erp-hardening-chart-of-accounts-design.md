# Mathan ERP Hardening and Chart of Accounts Design

## Status

Proposed design for review before implementation.

## Goal

Make the Mathan ERP MVP safe for multi-business accounting use by enforcing tenant ownership, strict accounting invariants, correct voucher lifecycle behavior, and a backend-owned chart of accounts that the frontend can render and extend later.

## Scope

This change covers the backend data model, REST contracts, accounting validation, voucher lifecycle, tenant boundaries, concurrency safety, and the frontend behaviors that currently contradict those contracts. It does not yet build a new chart-of-accounts screen; it makes the backend authoritative and supplies the metadata that a later screen can consume.

## Accounting model

Every ledger account receives a unique four-digit `accountCode` within its business. The code's first digit identifies the account class:

| Range | Class | Normal balance | Examples |
|---|---|---|---|
| 1000–1999 | Assets | Debit | cash, bank, receivables, inventory, equipment |
| 2000–2999 | Income | Credit | sales, service income, other income |
| 3000–3999 | Expenses | Debit | COGS, salaries, rent, utilities, administration |
| 4000–4999 | Liabilities | Credit | payables, tax payable, loans |
| 5000–5999 | Equity | Credit | capital, retained earnings, drawings |

Expense subranges are reserved as follows:

- `3100–3199`: cost of goods sold and direct costs.
- `3200–3899`: operating expenses.
- `3900–3999`: other expenses and adjustments.

The ranges are configuration rules, not hard-coded frontend assumptions. The API returns the class, nature, normal balance, code, display name, and parent group so a future frontend can render the hierarchy without duplicating accounting rules.

## Default chart seeded for a new business

Business creation will create the existing account groups plus these system ledgers. The exact code/name mapping is stable and deterministic:

| Code | Account | Group | Nature |
|---:|---|---|---|
| 1100 | Cash on Hand | Bank & Cash | Asset |
| 1110 | Petty Cash | Bank & Cash | Asset |
| 1200 | Main Bank | Bank & Cash | Asset |
| 1300 | Trade Receivables | Sundry Debtors | Asset |
| 1400 | Inventory Control | Current Assets | Asset |
| 1500 | Office Equipment | Fixed Assets | Asset |
| 2100 | Sales Revenue | Direct Income | Income |
| 2200 | Other Income | Direct Income | Income |
| 3100 | Cost of Sales | Direct Expense | Expense |
| 3200 | Payroll Expense | Direct Expense | Expense |
| 3300 | Rent Expense | Direct Expense | Expense |
| 3400 | Utilities Expense | Direct Expense | Expense |
| 3500 | Office & Administration | Direct Expense | Expense |
| 3600 | Depreciation Expense | Direct Expense | Expense |
| 4100 | Trade Payables | Sundry Creditors | Liability |
| 4200 | Tax Payable | Sundry Creditors | Liability |
| 4300 | Loans Payable | Sundry Creditors | Liability |
| 5100 | Share Capital | Capital Account | Equity |
| 5200 | Retained Earnings | Capital Account | Equity |
| 5300 | Drawings | Capital Account | Equity |

Existing businesses are not silently reseeded with duplicate accounts. A maintenance/backfill operation will add only missing default codes and will report conflicts requiring an administrator's decision.

## Data model changes

1. Add `account_code` to `ledger`, constrained to four digits and unique per business.
2. Add an optional `parent_ledger_id` to support future subaccounts while keeping the current account-group hierarchy. A ledger cannot parent itself, and the parent must belong to the same business.
3. Add a small `account_class`/chart metadata contract in code rather than a second user-editable table for the first iteration. This keeps the current `account_group` model intact while making range validation explicit and testable.
4. Add composite same-business foreign keys where practical, including `(business_id,id)` keys for referenced master records. Where PostgreSQL constraints cannot be added without a migration-risky rewrite, enforce ownership in the service transaction and add tests.
5. Keep historical voucher rows immutable in meaning. Existing account codes can be renamed only through a controlled master update; posted voucher lines continue to point to the same ledger ID.

## REST contract

The master ledger response will include:

```json
{
  "id": "uuid",
  "accountCode": "2100",
  "name": "Sales Revenue",
  "groupId": "uuid",
  "parentLedgerId": null,
  "groupName": "Direct Income",
  "nature": "Income",
  "normalBalance": "Cr",
  "isSystem": true,
  "active": true
}
```

The backend remains authoritative for `businessId`, actor, voucher number, status, and timestamps. Client-supplied copies of those fields are ignored.

## Tenant and reference integrity

Every create/update operation validates that all referenced IDs belong to the active business and are active when the operation requires an active record. This applies to:

- ledger group and parent ledger;
- party ledger;
- product unit;
- voucher currency, party, ledger lines, cost centers;
- stock product, warehouse, and unit;
- base currency settings.

The API returns a clear `400` or `403` domain error instead of relying on a raw database foreign-key exception.

## Voucher lifecycle

Allowed transitions are:

```text
Posted -> Cancelled
Posted -> Posted (controlled edit)
Cancelled -> no mutation
Cancelled -> no second cancellation
```

Editing a posted voucher rolls back its stock effect exactly once, replaces its lines and movements inside one transaction, validates the replacement, and reapplies the new effect. Cancellation rolls back stock exactly once and records an audit entry. A cancelled voucher cannot be edited or cancelled again.

Voucher creation requires a known open accounting period, a supported type, at least two valid lines for financial vouchers, balanced base amounts, positive exchange rate, and valid stock lines for inventory vouchers. Voucher numbering uses a PostgreSQL sequence or a locked per-business/type counter rather than `count + 1`.

## Reporting and scale

Backend report endpoints become the authoritative source for financial reports. The frontend will retain presentation and filtering but will stop loading all vouchers and recalculating accounting statements in browser memory. Report endpoints will accept optional date, currency, ledger, and pagination parameters where relevant. Existing report response shapes will be extended compatibly with account code and normal-balance metadata.

Stock summary will distinguish quantity from valuation. Until a formal costing engine is added, the API will label current valuation as provisional rather than presenting selling price as inventory cost. COGS automation is outside this first hardening migration but the chart reserves the required expense range and ledger.

## Frontend corrections in scope

- Stock adjustment, stock transfer, and payroll edit mode must call the voucher update endpoint instead of always creating a new voucher.
- Business profile save must either call a real name-update endpoint or stop claiming the name was saved; this design adds the name update to the authorized settings operation.
- Period edit/open/close controls must call real endpoints with permission checks, or be disabled until those endpoints exist. This implementation adds close/open behavior with audit logging.
- Business logout and business switching must clear stale business state and unsubscribe nested listeners.
- The REST adapter must not emulate unsupported atomic batch behavior for operations that require a server transaction.

## Security and operations

- Target-user membership is verified before changing a user's global profile or PIN.
- Account codes, roles, and permission keys are validated against allowlists.
- Domain/database constraint errors are mapped to stable API error codes.
- Audit entries are added for chart changes, period state changes, voucher updates/cancellations, settings changes, and user changes.
- Production deployment requires non-placeholder secrets, HTTPS, secure refresh cookies, restricted CORS, database backup/restore procedures, and structured logs.

## Testing requirements

Backend tests must cover:

- account-code range and uniqueness rules;
- default chart creation and idempotent backfill;
- cross-business reference rejection for every reference category;
- missing-period and closed-period rejection;
- empty/unbalanced/invalid voucher rejection;
- safe cancellation and repeated-cancellation rejection;
- cancelled-voucher edit rejection;
- stock rollback exactly once during edit and cancel;
- concurrent voucher number uniqueness;
- target-user membership checks;
- report totals excluding cancelled vouchers.

Frontend tests must cover:

- account codes rendered in ledger/master/report data;
- edit paths for every voucher type;
- settings save and period controls;
- logout/business switching without stale API headers.

## Non-goals for this iteration

- A redesigned chart-of-accounts user interface.
- Tax calculation and filing workflows.
- Full FIFO/weighted-average costing.
- Payroll statutory deductions.
- External invitations, email, or payment integrations.
