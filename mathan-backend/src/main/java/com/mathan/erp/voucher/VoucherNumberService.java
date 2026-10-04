package com.mathan.erp.voucher;

import java.util.Locale;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class VoucherNumberService {
  private final JdbcClient db;
  public VoucherNumberService(JdbcClient db) { this.db = db; }

  public String next(UUID businessId, String voucherType) {
    String normalized = voucherType.trim().toUpperCase(Locale.ROOT);
    Long number = db.sql("insert into voucher_number_counter(business_id,voucher_type,last_number) values(:b,:t,1) "
            + "on conflict(business_id,voucher_type) do update set last_number=voucher_number_counter.last_number+1 "
            + "returning last_number")
        .param("b", businessId).param("t", normalized).query(Long.class).single();
    String prefix = normalized.replaceAll("[^A-Z0-9]", "");
    if (prefix.isBlank()) prefix = "VCH";
    return prefix.substring(0, Math.min(3, prefix.length())) + "-" + String.format("%06d", number);
  }
}
