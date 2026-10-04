# Mathan ERP

Mathan ERP is a multi-business accounting and inventory MVP with a React frontend, Spring Boot API, and PostgreSQL database.

## Run with Docker Desktop

1. Copy `mathan-backend/.env.example` to `mathan-backend/.env` and replace every secret placeholder.
2. Copy `mathan-frontend/.env.example` to `mathan-frontend/.env`; this file contains public frontend configuration only.
3. Run `docker compose up --build`.
4. Open `http://localhost:3000` and sign in with the configured bootstrap username and PIN.
5. API documentation is available at `http://localhost:8081/swagger-ui.html`.

PostgreSQL data is stored in the `mathan_postgres` Docker volume. Use `docker compose down` to stop the application without deleting its data.

## Local development

- Frontend: enter `mathan-frontend`, run `npm install`, then `npm run dev`.
- Backend: run PostgreSQL, configure the variables from `mathan-backend/.env.example`, then run `./mvnw spring-boot:run` when a Maven wrapper or local Maven is available.
- The Vite development server proxies `/api` to the backend. Docker Compose exposes it at `http://localhost:8082`; a local Spring Boot run uses `http://localhost:8080`.

The backend applies Flyway migrations automatically. The first startup creates only the bootstrap administrator; the first business and its default account groups are created through the UI.

### Chart of accounts

Creating a business seeds a backend-owned chart with stable four-digit codes. Assets use `1000–1999`, income `2000–2999`, expenses `3000–3999`, liabilities `4000–4999`, and equity `5000–5999`. The API exposes `accountCode`, `nature`, and `normalBalance` on the ledger master endpoint. Custom ledgers may omit a code and receive the next available code in their account-group range; supplied codes are validated against that range.

The detailed chart contract is available at `GET /api/v1/chart-of-accounts`: it returns the five ranges, expense subranges (`3100–3199` cost of sales, `3200–3899` operating expenses, `3900–3999` other expenses), the `5300` drawings debit exception, and the seeded accounts. The frontend can render this metadata without duplicating accounting rules.

Inventory uses backend moving-average costing. Receipts update `stock_balance.inventory_value` and `average_cost`; sales issue stock at carrying cost and automatically post `3100 Cost of Sales` against `1400 Inventory Control`; sales returns reverse that entry. Existing pre-costing movements are migrated with a documented `LEGACY_RATE_FALLBACK` basis, which the stock report exposes and should be reconciled after upgrade; new movements are marked `MOVING_AVERAGE_COST`. Master-data bulk actions use `POST /api/v1/batch`, which executes the operations in one database transaction.

`GET /api/v1/reports/stock-summary?to=YYYY-MM-DD` produces an inventory position as of the cutoff date from posted stock movements and carrying cost; it does not use selling prices. `GET /api/v1/reports/stock-reconciliation` compares the live stored stock balances with the posted movement ledger and reports quantity/value variances. Supplying `to` to reconciliation marks the result as historical-movements-only because the system stores a live balance snapshot, not daily historical snapshots.

Voucher numbers are allocated by a database-backed per-business/per-type counter, and all voucher/master references are checked against the active business before writes.

Validation failures return a stable JSON error with `status`, `code`, `message`, and optional `fieldErrors`; invalid stock lines require valid product, warehouse, unit, non-zero quantity, and non-negative rate. The frontend validates required dates, currencies, rates, amounts, names, account groups, units, and dependent master fields before submission, and displays one actionable toast for rejected requests.

The PostgreSQL chart integration test is opt-in because it requires Docker: run `./mvnw -Drun.integration=true -Dtest=ChartServiceIntegrationTest test` from `mathan-backend`.
