-- Surface historical cross-business references before constraints are added.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ledger l JOIN account_group g ON g.id=l.group_id WHERE l.business_id<>g.business_id)
    OR EXISTS (SELECT 1 FROM ledger l JOIN ledger p ON p.id=l.parent_ledger_id WHERE l.business_id<>p.business_id)
    OR EXISTS (SELECT 1 FROM party p JOIN ledger l ON l.id=p.ledger_id WHERE p.business_id<>l.business_id)
    OR EXISTS (SELECT 1 FROM product p JOIN unit u ON u.id=p.base_unit_id WHERE p.business_id<>u.business_id)
    OR EXISTS (SELECT 1 FROM voucher v JOIN currency c ON c.id=v.currency_id WHERE c.business_id IS NULL OR v.business_id<>c.business_id)
    OR EXISTS (SELECT 1 FROM voucher v JOIN party p ON p.id=v.party_id WHERE v.business_id<>p.business_id)
    OR EXISTS (SELECT 1 FROM business b JOIN currency c ON c.id=b.base_currency_id WHERE c.business_id IS NULL OR b.id<>c.business_id)
  THEN RAISE EXCEPTION 'Cross-business master reference found; repair data before applying V5';
  END IF;
END $$;

ALTER TABLE voucher_line ADD COLUMN business_id uuid;
UPDATE voucher_line vl SET business_id=v.business_id FROM voucher v WHERE v.id=vl.voucher_id;
ALTER TABLE voucher_line ALTER COLUMN business_id SET NOT NULL;

ALTER TABLE stock_movement ADD COLUMN business_id uuid;
UPDATE stock_movement sm SET business_id=v.business_id FROM voucher v WHERE v.id=sm.voucher_id;
ALTER TABLE stock_movement ALTER COLUMN business_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM voucher_line vl JOIN voucher v ON v.id=vl.voucher_id WHERE vl.business_id<>v.business_id)
    OR EXISTS (SELECT 1 FROM voucher_line vl JOIN ledger l ON l.id=vl.ledger_id WHERE vl.business_id<>l.business_id)
    OR EXISTS (SELECT 1 FROM voucher_line vl JOIN cost_center c ON c.id=vl.cost_center_id WHERE vl.business_id<>c.business_id)
    OR EXISTS (SELECT 1 FROM stock_movement sm JOIN voucher v ON v.id=sm.voucher_id WHERE sm.business_id<>v.business_id)
    OR EXISTS (SELECT 1 FROM stock_movement sm JOIN product p ON p.id=sm.product_id WHERE sm.business_id<>p.business_id)
    OR EXISTS (SELECT 1 FROM stock_movement sm JOIN warehouse w ON w.id=sm.warehouse_id WHERE sm.business_id<>w.business_id)
    OR EXISTS (SELECT 1 FROM stock_movement sm JOIN unit u ON u.id=sm.unit_id WHERE sm.business_id<>u.business_id)
    OR EXISTS (SELECT 1 FROM stock_balance sb JOIN product p ON p.id=sb.product_id WHERE sb.business_id<>p.business_id)
    OR EXISTS (SELECT 1 FROM stock_balance sb JOIN warehouse w ON w.id=sb.warehouse_id WHERE sb.business_id<>w.business_id)
  THEN RAISE EXCEPTION 'Cross-business transaction reference found; repair data before applying V5';
  END IF;
END $$;

ALTER TABLE account_group ADD CONSTRAINT uq_account_group_business_id UNIQUE (business_id,id);
ALTER TABLE ledger ADD CONSTRAINT uq_ledger_business_id UNIQUE (business_id,id);
ALTER TABLE party ADD CONSTRAINT uq_party_business_id UNIQUE (business_id,id);
ALTER TABLE unit ADD CONSTRAINT uq_unit_business_id UNIQUE (business_id,id);
ALTER TABLE warehouse ADD CONSTRAINT uq_warehouse_business_id UNIQUE (business_id,id);
ALTER TABLE product ADD CONSTRAINT uq_product_business_id UNIQUE (business_id,id);
ALTER TABLE cost_center ADD CONSTRAINT uq_cost_center_business_id UNIQUE (business_id,id);
ALTER TABLE period ADD CONSTRAINT uq_period_business_id UNIQUE (business_id,id);
ALTER TABLE currency ADD CONSTRAINT uq_currency_business_id UNIQUE (business_id,id);
ALTER TABLE voucher ADD CONSTRAINT uq_voucher_business_id UNIQUE (business_id,id);

ALTER TABLE ledger ADD CONSTRAINT fk_ledger_group_same_business FOREIGN KEY (business_id,group_id) REFERENCES account_group(business_id,id);
ALTER TABLE ledger ADD CONSTRAINT fk_ledger_parent_same_business FOREIGN KEY (business_id,parent_ledger_id) REFERENCES ledger(business_id,id);
ALTER TABLE party ADD CONSTRAINT fk_party_ledger_same_business FOREIGN KEY (business_id,ledger_id) REFERENCES ledger(business_id,id);
ALTER TABLE product ADD CONSTRAINT fk_product_unit_same_business FOREIGN KEY (business_id,base_unit_id) REFERENCES unit(business_id,id);
ALTER TABLE voucher ADD CONSTRAINT fk_voucher_currency_same_business FOREIGN KEY (business_id,currency_id) REFERENCES currency(business_id,id);
ALTER TABLE voucher ADD CONSTRAINT fk_voucher_party_same_business FOREIGN KEY (business_id,party_id) REFERENCES party(business_id,id);
ALTER TABLE business ADD CONSTRAINT fk_business_currency_same_business FOREIGN KEY (id,base_currency_id) REFERENCES currency(business_id,id);
ALTER TABLE voucher_line ADD CONSTRAINT fk_voucher_line_voucher_same_business FOREIGN KEY (business_id,voucher_id) REFERENCES voucher(business_id,id);
ALTER TABLE voucher_line ADD CONSTRAINT fk_voucher_line_ledger_same_business FOREIGN KEY (business_id,ledger_id) REFERENCES ledger(business_id,id);
ALTER TABLE voucher_line ADD CONSTRAINT fk_voucher_line_cost_center_same_business FOREIGN KEY (business_id,cost_center_id) REFERENCES cost_center(business_id,id);
ALTER TABLE stock_movement ADD CONSTRAINT fk_stock_movement_voucher_same_business FOREIGN KEY (business_id,voucher_id) REFERENCES voucher(business_id,id);
ALTER TABLE stock_movement ADD CONSTRAINT fk_stock_movement_product_same_business FOREIGN KEY (business_id,product_id) REFERENCES product(business_id,id);
ALTER TABLE stock_movement ADD CONSTRAINT fk_stock_movement_warehouse_same_business FOREIGN KEY (business_id,warehouse_id) REFERENCES warehouse(business_id,id);
ALTER TABLE stock_movement ADD CONSTRAINT fk_stock_movement_unit_same_business FOREIGN KEY (business_id,unit_id) REFERENCES unit(business_id,id);
ALTER TABLE stock_balance ADD CONSTRAINT fk_stock_balance_product_same_business FOREIGN KEY (business_id,product_id) REFERENCES product(business_id,id);
ALTER TABLE stock_balance ADD CONSTRAINT fk_stock_balance_warehouse_same_business FOREIGN KEY (business_id,warehouse_id) REFERENCES warehouse(business_id,id);

CREATE INDEX ix_voucher_line_business ON voucher_line(business_id);
CREATE INDEX ix_stock_movement_business ON stock_movement(business_id);
