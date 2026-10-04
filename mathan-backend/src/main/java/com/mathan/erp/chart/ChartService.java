package com.mathan.erp.chart;

import com.mathan.erp.api.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChartService {
  private final JdbcClient db;

  public ChartService(JdbcClient db) {
    this.db = db;
  }

  public record ChartSeedResult(int created, int existing, List<String> conflicts) {}

  @Transactional
  public ChartSeedResult seedDefaults(UUID businessId) {
    int created = 0;
    int existing = 0;
    var conflicts = new java.util.ArrayList<String>();

    for (var account : ChartOfAccounts.defaults()) {
      UUID groupId = ensureGroup(businessId, account.groupName(), account.nature());
      var current = db.sql("select id,name from ledger where business_id=:b and account_code=:c")
          .param("b", businessId)
          .param("c", account.code())
          .query((rs, n) -> Map.of(
              "id", rs.getObject("id", UUID.class),
              "name", rs.getString("name")))
          .optional();
      if (current.isPresent()) {
        existing++;
        if (!account.name().equals(current.get().get("name"))) {
          conflicts.add(account.code() + ": existing account is named " + current.get().get("name"));
        }
        continue;
      }
      db.sql("insert into ledger(id,business_id,account_code,name,group_id,system,active) "
              + "values(:id,:b,:c,:n,:g,:s,true)")
          .param("id", UUID.randomUUID())
          .param("b", businessId)
          .param("c", account.code())
          .param("n", account.name())
          .param("g", groupId)
          .param("s", account.system())
          .update();
      created++;
    }
    return new ChartSeedResult(created, existing, List.copyOf(conflicts));
  }

  public List<Map<String, Object>> list(UUID businessId) {
    return db.sql("select l.id,l.account_code,l.name,l.group_id,l.parent_ledger_id,l.system,l.opening_balance,"
            + "l.opening_balance_type,l.active,g.name group_name,g.nature "
            + "from ledger l join account_group g on g.id=l.group_id "
            + "where l.business_id=:b order by l.account_code,l.name")
        .param("b", businessId)
        .query((rs, n) -> {
          String code = rs.getString("account_code");
          String nature = rs.getString("nature");
          var row = new LinkedHashMap<String, Object>();
          row.put("id", rs.getObject("id", UUID.class));
          row.put("accountCode", code);
          row.put("name", rs.getString("name"));
          row.put("groupId", rs.getObject("group_id", UUID.class));
          row.put("parentLedgerId", rs.getObject("parent_ledger_id", UUID.class));
          row.put("isSystem", rs.getBoolean("system"));
          row.put("openingBalance", rs.getBigDecimal("opening_balance"));
          row.put("openingBalanceType", rs.getString("opening_balance_type"));
          row.put("active", rs.getBoolean("active"));
          row.put("groupName", rs.getString("group_name"));
          row.put("nature", nature);
          row.put("normalBalance", normalBalance(nature, code));
          return (Map<String, Object>) row;
        })
        .list();
  }

  public Map<String, Object> get(UUID businessId, UUID ledgerId) {
    return list(businessId).stream()
        .filter(row -> ledgerId.equals(row.get("id")))
        .findFirst()
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Ledger was not found"));
  }

  public void validateLedger(UUID businessId, JsonNode body, UUID existingId) {
    var current = existingId == null ? java.util.Optional.<Map<String,Object>>empty() : db.sql("select account_code,group_id from ledger where id=:id and business_id=:b")
        .param("id", existingId).param("b", businessId)
        .query((rs,n)->Map.of("code",rs.getString(1),"group",rs.getObject(2,UUID.class))).optional();
    if (existingId != null && body.hasNonNull("accountCode") && current.isPresent()
        && db.sql("select system from ledger where id=:id and business_id=:b").param("id", existingId).param("b", businessId).query(Boolean.class).single()
        && !body.get("accountCode").asText().equals(current.get().get("code")))
      throw new ApiException(HttpStatus.CONFLICT, "SYSTEM_LEDGER_CODE", "System ledger account codes cannot be changed");
    String code = body.has("accountCode") ? body.path("accountCode").asText() : current.map(x -> (String)x.get("code")).orElse("");
    if (code.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "ACCOUNT_CODE_REQUIRED", "Ledger accountCode is required");
    }
    String groupId = body.has("groupId") ? body.path("groupId").asText() : current.map(x -> x.get("group").toString()).orElse("");
    if (groupId.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "ACCOUNT_GROUP_REQUIRED", "Ledger groupId is required");
    }
    UUID group;
    try {
      group = UUID.fromString(groupId);
    } catch (IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ACCOUNT_GROUP", "Ledger groupId is invalid");
    }
    String nature = db.sql("select nature from account_group where id=:g and business_id=:b and active")
        .param("g", group)
        .param("b", businessId)
        .query(String.class)
        .optional()
        .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ACCOUNT_GROUP", "Account group is outside this business"));
    try {
      ChartOfAccounts.validate(code, ChartOfAccounts.AccountNature.valueOf(nature.toUpperCase()));
    } catch (IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ACCOUNT_CODE", ex.getMessage());
    }
    if (body.hasNonNull("parentLedgerId")) {
      UUID parent;
      try {
        parent = UUID.fromString(body.get("parentLedgerId").asText());
      } catch (IllegalArgumentException ex) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PARENT_LEDGER", "parentLedgerId is invalid");
      }
      if (existingId != null && existingId.equals(parent)) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PARENT_LEDGER", "A ledger cannot parent itself");
      }
      Boolean parentExists = db.sql("select exists(select 1 from ledger where id=:p and business_id=:b and active)")
          .param("p", parent)
          .param("b", businessId)
          .query(Boolean.class)
          .single();
      if (!Boolean.TRUE.equals(parentExists)) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PARENT_LEDGER", "Parent ledger is outside this business");
      }
    }
  }

  public String allocateCode(UUID businessId, UUID groupId) {
    String nature = db.sql("select nature from account_group where id=:g and business_id=:b and active")
        .param("g", groupId).param("b", businessId).query(String.class).optional()
        .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ACCOUNT_GROUP", "Account group is outside this business"));
    db.sql("select pg_advisory_xact_lock(hashtextextended(:key,0))")
        .param("key", businessId + ":" + nature).query((rs, n) -> rs.getObject(1)).list();
    int start = switch (nature.toUpperCase()) { case "ASSET" -> 1000; case "INCOME" -> 2000; case "EXPENSE" -> 3000; case "LIABILITY" -> 4000; case "EQUITY" -> 5000; default -> throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ACCOUNT_GROUP", "Unsupported account group nature"); };
    for (int code = start; code < start + 1000; code++) {
      String candidate = Integer.toString(code);
      if (!db.sql("select exists(select 1 from ledger where business_id=:b and account_code=:c)").param("b", businessId).param("c", candidate).query(Boolean.class).single()) return candidate;
    }
    throw new ApiException(HttpStatus.CONFLICT, "ACCOUNT_CODE_EXHAUSTED", "No account codes remain in this range");
  }

  private UUID ensureGroup(UUID businessId, String name, ChartOfAccounts.AccountNature nature) {
    return db.sql("select id from account_group where business_id=:b and name=:n")
        .param("b", businessId)
        .param("n", name)
        .query(UUID.class)
        .optional()
        .orElseGet(() -> {
          UUID id = UUID.randomUUID();
          db.sql("insert into account_group(id,business_id,name,nature,active) values(:id,:b,:n,:x,true)")
              .param("id", id)
              .param("b", businessId)
              .param("n", name)
              .param("x", title(nature))
              .update();
          return id;
        });
  }

  private String normalBalance(String nature, String code) {
    return ChartOfAccounts.normalBalance(
        ChartOfAccounts.AccountNature.valueOf(nature.toUpperCase()), code).name();
  }

  private String title(ChartOfAccounts.AccountNature nature) {
    String lower = nature.name().toLowerCase();
    return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
  }
}
