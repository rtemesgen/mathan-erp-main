ALTER TABLE ledger ADD COLUMN account_code varchar(4);
ALTER TABLE ledger ADD COLUMN parent_ledger_id uuid REFERENCES ledger(id);

UPDATE ledger
SET account_code = CASE name
  WHEN 'Cash on Hand' THEN '1100'
  WHEN 'Petty Cash' THEN '1110'
  WHEN 'Main Bank' THEN '1200'
  WHEN 'Trade Receivables' THEN '1300'
  WHEN 'Inventory Control' THEN '1400'
  WHEN 'Office Equipment' THEN '1500'
  WHEN 'Sales Revenue' THEN '2100'
  WHEN 'Other Income' THEN '2200'
  WHEN 'Cost of Sales' THEN '3100'
  WHEN 'Payroll Expense' THEN '3200'
  WHEN 'Rent Expense' THEN '3300'
  WHEN 'Utilities Expense' THEN '3400'
  WHEN 'Office & Administration' THEN '3500'
  WHEN 'Depreciation Expense' THEN '3600'
  WHEN 'Trade Payables' THEN '4100'
  WHEN 'Tax Payable' THEN '4200'
  WHEN 'Loans Payable' THEN '4300'
  WHEN 'Share Capital' THEN '5100'
  WHEN 'Retained Earnings' THEN '5200'
  WHEN 'Drawings' THEN '5300'
  ELSE account_code
END
WHERE account_code IS NULL;

DO $$
DECLARE
  row_data record;
  next_code integer;
  code_limit integer;
BEGIN
  FOR row_data IN
    SELECT l.id, l.business_id, g.nature
    FROM ledger l
    JOIN account_group g ON g.id = l.group_id
    WHERE l.account_code IS NULL
    ORDER BY l.id
  LOOP
    next_code := CASE row_data.nature
      WHEN 'Asset' THEN 1600
      WHEN 'Income' THEN 2300
      WHEN 'Expense' THEN 3700
      WHEN 'Liability' THEN 4400
      WHEN 'Equity' THEN 5400
    END;
    code_limit := CASE row_data.nature
      WHEN 'Asset' THEN 1999
      WHEN 'Income' THEN 2999
      WHEN 'Expense' THEN 3999
      WHEN 'Liability' THEN 4999
      WHEN 'Equity' THEN 5999
    END;

    WHILE EXISTS (
      SELECT 1 FROM ledger l
      WHERE l.business_id = row_data.business_id
        AND l.account_code = next_code::varchar
    ) LOOP
      next_code := next_code + 1;
    END LOOP;

    IF next_code > code_limit THEN
      RAISE EXCEPTION 'No available chart account code for business % and nature %',
        row_data.business_id, row_data.nature;
    END IF;

    UPDATE ledger
    SET account_code = next_code::varchar
    WHERE id = row_data.id;
  END LOOP;
END $$;

ALTER TABLE ledger
  ADD CONSTRAINT ck_ledger_account_code_format
  CHECK (account_code ~ '^[1-5][0-9]{3}$');

ALTER TABLE ledger
  ADD CONSTRAINT ck_ledger_parent_not_self
  CHECK (parent_ledger_id IS NULL OR parent_ledger_id <> id);

ALTER TABLE ledger ALTER COLUMN account_code SET NOT NULL;

CREATE UNIQUE INDEX ux_ledger_business_account_code
  ON ledger(business_id, account_code);

CREATE INDEX ix_ledger_parent ON ledger(parent_ledger_id);
