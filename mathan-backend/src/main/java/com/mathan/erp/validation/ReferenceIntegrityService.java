package com.mathan.erp.validation;

import com.mathan.erp.api.ApiException;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class ReferenceIntegrityService {
  private static final Map<String, String> TABLES = Map.of(
      "group", "account_group",
      "ledger", "ledger",
      "currency", "currency",
      "party", "party",
      "unit", "unit",
      "warehouse", "warehouse",
      "product", "product",
      "costCenter", "cost_center",
      "period", "period");

  private final JdbcClient db;

  public ReferenceIntegrityService(JdbcClient db) {
    this.db = db;
  }

  public void requireGroup(UUID businessId, UUID id, boolean active) {
    require("group", businessId, id, active);
  }

  public void requireLedger(UUID businessId, UUID id, boolean active) {
    require("ledger", businessId, id, active);
  }

  public void requireCurrency(UUID businessId, UUID id, boolean active) {
    require("currency", businessId, id, active);
  }

  public void requireParty(UUID businessId, UUID id, boolean active) {
    require("party", businessId, id, active);
  }

  public void requireUnit(UUID businessId, UUID id, boolean active) {
    require("unit", businessId, id, active);
  }

  public void requireWarehouse(UUID businessId, UUID id, boolean active) {
    require("warehouse", businessId, id, active);
  }

  public void requireProduct(UUID businessId, UUID id, boolean active) {
    require("product", businessId, id, active);
  }

  public void requireCostCenter(UUID businessId, UUID id, boolean active) {
    require("costCenter", businessId, id, active);
  }

  public void requirePeriod(UUID businessId, UUID id, boolean active) {
    require("period", businessId, id, active);
  }

  private void require(String kind, UUID businessId, UUID id, boolean active) {
    if (id == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REFERENCE", kind + " identifier is required");
    }
    String table = TABLES.get(kind);
    String activeClause = active ? " and active" : "";
    Boolean inBusiness = db.sql("select exists(select 1 from " + table
            + " where id=:id and business_id=:b" + activeClause + ")")
        .param("id", id)
        .param("b", businessId)
        .query(Boolean.class)
        .single();
    if (Boolean.TRUE.equals(inBusiness)) return;

    Boolean belongs = db.sql("select exists(select 1 from " + table + " where id=:id and business_id=:b)")
        .param("id", id)
        .param("b", businessId)
        .query(Boolean.class)
        .single();
    if (Boolean.TRUE.equals(belongs) && active) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "REFERENCE_INACTIVE", kind + " is inactive");
    }
    throw new ApiException(HttpStatus.FORBIDDEN, "REFERENCE_OUTSIDE_BUSINESS", kind + " is outside this business");
  }
}
