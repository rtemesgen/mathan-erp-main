ALTER TABLE stock_balance
  ADD COLUMN inventory_value numeric(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN average_cost numeric(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN costing_basis varchar(40) NOT NULL DEFAULT 'LEGACY_RATE_FALLBACK';

ALTER TABLE stock_movement
  ADD COLUMN cost_value numeric(19,4) NOT NULL DEFAULT 0;

-- Existing movements did not retain issue cost. Preserve a transparent legacy
-- fallback so the new costing engine can take over without losing quantities.
UPDATE stock_movement SET cost_value = quantity * rate WHERE cost_value = 0;
UPDATE stock_balance sb
SET inventory_value = x.inventory_value,
    average_cost = CASE WHEN sb.quantity <> 0 THEN abs(x.inventory_value / sb.quantity) ELSE 0 END
FROM (
  SELECT business_id, product_id, warehouse_id, coalesce(sum(cost_value), 0) inventory_value
  FROM stock_movement
  GROUP BY business_id, product_id, warehouse_id
) x
WHERE sb.business_id = x.business_id
  AND sb.product_id = x.product_id
  AND sb.warehouse_id = x.warehouse_id;
