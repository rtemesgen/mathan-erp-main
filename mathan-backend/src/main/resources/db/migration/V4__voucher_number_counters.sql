create table voucher_number_counter (
  business_id uuid not null references business(id) on delete cascade,
  voucher_type varchar(40) not null,
  last_number bigint not null default 0 check (last_number >= 0),
  primary key (business_id, voucher_type)
);

-- Preserve the highest historical numeric suffix before new numbering begins.
INSERT INTO voucher_number_counter (business_id, voucher_type, last_number)
SELECT business_id, type, max((substring(number from '([0-9]+)$'))::bigint)
FROM voucher
WHERE number ~ '[0-9]+$'
GROUP BY business_id, type;
