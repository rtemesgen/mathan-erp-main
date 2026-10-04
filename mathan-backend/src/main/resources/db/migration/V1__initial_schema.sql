CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username varchar(80) NOT NULL UNIQUE,
  display_name varchar(120) NOT NULL, pin_hash varchar(100) NOT NULL, active boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0, locked_until timestamptz, version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE business (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(200) NOT NULL,
  base_currency_id uuid, allow_negative_inventory boolean NOT NULL DEFAULT false,
  owner_user_id uuid NOT NULL REFERENCES app_user(id), version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE membership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_user(id),
  business_id uuid NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  role varchar(30) NOT NULL CHECK (role IN ('admin','supervisor','accountant','sales','storekeeper')),
  active boolean NOT NULL DEFAULT true, masters boolean NOT NULL DEFAULT false,
  transactions boolean NOT NULL DEFAULT false, reports boolean NOT NULL DEFAULT false,
  audit boolean NOT NULL DEFAULT false, users boolean NOT NULL DEFAULT false, settings boolean NOT NULL DEFAULT false,
  UNIQUE(user_id,business_id)
);
CREATE TABLE refresh_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz,
  replaced_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE currency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid REFERENCES business(id) ON DELETE CASCADE,
  code varchar(3) NOT NULL, name varchar(100) NOT NULL, symbol varchar(10) NOT NULL,
  exchange_rate numeric(19,6) NOT NULL CHECK(exchange_rate > 0), active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 0, UNIQUE(business_id,code)
);
ALTER TABLE business ADD CONSTRAINT fk_business_currency FOREIGN KEY(base_currency_id) REFERENCES currency(id);

CREATE TABLE period (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id) ON DELETE CASCADE,
 name varchar(200) NOT NULL, start_date date NOT NULL, end_date date NOT NULL, closed boolean NOT NULL DEFAULT false,
 version bigint NOT NULL DEFAULT 0, CHECK(start_date <= end_date), UNIQUE(business_id,name)
);
CREATE TABLE account_group (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id) ON DELETE CASCADE,
 name varchar(200) NOT NULL, nature varchar(20) NOT NULL CHECK(nature IN ('Asset','Liability','Equity','Income','Expense')),
 active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 0, UNIQUE(business_id,name)
);
CREATE TABLE ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id) ON DELETE CASCADE,
 name varchar(200) NOT NULL, group_id uuid NOT NULL REFERENCES account_group(id), system boolean NOT NULL DEFAULT false,
 opening_balance numeric(19,4) NOT NULL DEFAULT 0, opening_balance_type varchar(2) NOT NULL DEFAULT 'Dr' CHECK(opening_balance_type IN ('Dr','Cr')),
 active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 0, UNIQUE(business_id,name)
);
CREATE TABLE party (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id) ON DELETE CASCADE,
 name varchar(200) NOT NULL, type varchar(10) NOT NULL CHECK(type IN ('Customer','Supplier','Both')),
 ledger_id uuid NOT NULL REFERENCES ledger(id), active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 0,
 UNIQUE(business_id,name)
);
CREATE TABLE unit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id) ON DELETE CASCADE,
 name varchar(100) NOT NULL, active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 0, UNIQUE(business_id,name)
);
CREATE TABLE warehouse (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id) ON DELETE CASCADE,
 name varchar(200) NOT NULL, active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 0, UNIQUE(business_id,name)
);
CREATE TABLE product (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id) ON DELETE CASCADE,
 name varchar(200) NOT NULL, base_unit_id uuid NOT NULL REFERENCES unit(id), selling_price numeric(19,4) NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 0, UNIQUE(business_id,name)
);
CREATE TABLE employee (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id) ON DELETE CASCADE,
 name varchar(200) NOT NULL, designation varchar(120) NOT NULL, basic_salary numeric(19,4) NOT NULL DEFAULT 0,
 join_date date NOT NULL, active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 0, UNIQUE(business_id,name)
);
CREATE TABLE cost_center (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id) ON DELETE CASCADE,
 name varchar(200) NOT NULL, active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 0, UNIQUE(business_id,name)
);
CREATE TABLE voucher (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES business(id),
 type varchar(30) NOT NULL, voucher_date date NOT NULL, number varchar(50) NOT NULL, status varchar(15) NOT NULL DEFAULT 'Posted',
 narration text NOT NULL DEFAULT '', actor_id uuid NOT NULL REFERENCES app_user(id), currency_id uuid NOT NULL REFERENCES currency(id),
 exchange_rate numeric(19,6) NOT NULL CHECK(exchange_rate > 0), party_id uuid REFERENCES party(id),
 version bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,number)
);
CREATE TABLE voucher_line (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), voucher_id uuid NOT NULL REFERENCES voucher(id) ON DELETE CASCADE,
 ledger_id uuid NOT NULL REFERENCES ledger(id), debit numeric(19,4) NOT NULL DEFAULT 0 CHECK(debit >= 0),
 credit numeric(19,4) NOT NULL DEFAULT 0 CHECK(credit >= 0), txn_debit numeric(19,4), txn_credit numeric(19,4),
 cost_center_id uuid REFERENCES cost_center(id), CHECK((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE TABLE bill_allocation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), voucher_line_id uuid NOT NULL REFERENCES voucher_line(id) ON DELETE CASCADE,
 bill_no varchar(80) NOT NULL, amount numeric(19,4) NOT NULL, type varchar(20) NOT NULL, due_date date
);
CREATE TABLE stock_movement (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), voucher_id uuid NOT NULL REFERENCES voucher(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES product(id), warehouse_id uuid NOT NULL REFERENCES warehouse(id), unit_id uuid NOT NULL REFERENCES unit(id),
 quantity numeric(19,4) NOT NULL, rate numeric(19,4) NOT NULL DEFAULT 0
);
CREATE TABLE stock_balance (
 business_id uuid NOT NULL REFERENCES business(id), product_id uuid NOT NULL REFERENCES product(id),
 warehouse_id uuid NOT NULL REFERENCES warehouse(id), quantity numeric(19,4) NOT NULL DEFAULT 0,
 version bigint NOT NULL DEFAULT 0, PRIMARY KEY(business_id,product_id,warehouse_id)
);
CREATE TABLE audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid REFERENCES business(id), actor_id uuid REFERENCES app_user(id),
 action varchar(100) NOT NULL, entity_type varchar(80), entity_id uuid, details text NOT NULL DEFAULT '',
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_voucher_business_date ON voucher(business_id,voucher_date);
CREATE INDEX ix_audit_business_time ON audit_log(business_id,occurred_at DESC);
CREATE INDEX ix_stock_product_warehouse ON stock_movement(product_id,warehouse_id);

