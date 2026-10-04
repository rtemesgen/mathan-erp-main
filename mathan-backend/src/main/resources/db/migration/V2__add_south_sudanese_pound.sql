INSERT INTO currency (id, business_id, code, name, symbol, exchange_rate, active)
SELECT gen_random_uuid(), b.id, 'SSP', 'South Sudanese Pound', 'SSP', 1, true
FROM business b
WHERE NOT EXISTS (
  SELECT 1 FROM currency c WHERE c.business_id = b.id AND c.code = 'SSP'
);
