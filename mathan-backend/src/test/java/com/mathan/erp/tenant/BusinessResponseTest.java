package com.mathan.erp.tenant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import com.mathan.erp.security.UserPrincipal;
import java.math.BigDecimal;
import java.lang.reflect.Proxy;
import java.sql.ResultSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;

class BusinessResponseTest {
  @Test
  @SuppressWarnings("unchecked")
  void authorizedBusinessResponseIncludesBaseCurrencyWithoutMastersLookup() throws Exception {
    UUID userId = UUID.fromString("af43eb64-50ef-46b8-b8df-b83381bb8a11");
    UUID businessId = UUID.fromString("10df42da-ef4b-4aeb-8102-09105665b4b5");
    UUID currencyId = UUID.fromString("250f602c-e083-48c0-8ea8-7802d05f68de");
    ResultSet row = row(Map.of(
        "id", businessId,
        "name", "Authorized Business",
        "base_currency_id", currencyId,
        "base_currency_code", "UGX",
        "base_currency_name", "Uganda Shilling",
        "base_currency_symbol", "USh",
        "base_currency_exchange_rate", new BigDecimal("1.000000"),
        "base_currency_active", true,
        "allow_negative_inventory", false));
    BusinessController controller = authorizedControllerFor(row);

    List<?> businesses = controller.list(new UserPrincipal(userId, "owner"));

    assertEquals(1, businesses.size());
    Map<String, Object> business = (Map<String, Object>) businesses.get(0);
    assertEquals(currencyId.toString(), business.get("baseCurrencyId"));
    assertEquals("UGX", business.get("baseCurrencyCode"));
    Map<String, Object> baseCurrency = (Map<String, Object>) business.get("baseCurrency");
    assertNotNull(baseCurrency);
    assertEquals(currencyId, baseCurrency.get("id"));
    assertEquals("UGX", baseCurrency.get("code"));
    assertEquals("Uganda Shilling", baseCurrency.get("name"));
    assertEquals("USh", baseCurrency.get("symbol"));
    assertEquals(new BigDecimal("1.000000"), baseCurrency.get("exchangeRate"));
    assertEquals(true, baseCurrency.get("active"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void authorizedBusinessWithoutBaseCurrencyReturnsExplicitNullContext() throws Exception {
    UUID userId = UUID.fromString("af43eb64-50ef-46b8-b8df-b83381bb8a11");
    UUID businessId = UUID.fromString("10df42da-ef4b-4aeb-8102-09105665b4b5");
    ResultSet row = row(Map.of("id", businessId, "name", "No Currency", "base_currency_active", false, "allow_negative_inventory", false));

    List<?> businesses = authorizedControllerFor(row).list(new UserPrincipal(userId, "owner"));

    Map<String, Object> business = (Map<String, Object>) businesses.get(0);
    assertEquals("", business.get("baseCurrencyId"));
    assertEquals("", business.get("baseCurrencyCode"));
    assertTrue(business.containsKey("baseCurrency"));
    assertNull(business.get("baseCurrency"));
  }

  @Test
  void authorizedBusinessListQueryBindsTheAuthenticatedUserAndActiveMembership() throws Exception {
    UUID userId = UUID.fromString("af43eb64-50ef-46b8-b8df-b83381bb8a11");
    ResultSet row = row(Map.of("id", UUID.randomUUID(), "name", "Authorized", "base_currency_active", false, "allow_negative_inventory", false));
    AtomicReference<String> sql = new AtomicReference<>();
    Map<String, Object> parameters = new java.util.HashMap<>();

    authorizedControllerFor(row, sql, parameters).list(new UserPrincipal(userId, "owner"));

    assertTrue(sql.get().contains("m.user_id=:u"));
    assertTrue(sql.get().contains("m.active"));
    assertEquals(userId, parameters.get("u"));
  }

  @SuppressWarnings("unchecked")
  private static BusinessController authorizedControllerFor(ResultSet row) {
    return authorizedControllerFor(row, new AtomicReference<>(), new java.util.HashMap<>());
  }

  @SuppressWarnings("unchecked")
  private static BusinessController authorizedControllerFor(ResultSet row, AtomicReference<String> sql, Map<String, Object> parameters) {
    AtomicReference<RowMapper<Map<String, Object>>> mapperReference = new AtomicReference<>();
    AtomicReference<JdbcClient.StatementSpec> statementReference = new AtomicReference<>();
    JdbcClient db = proxy(JdbcClient.class, (method, args) -> {
      if (!method.equals("sql")) return null;
      sql.set((String) args[0]);
      JdbcClient.StatementSpec statement = proxy(JdbcClient.StatementSpec.class, (statementMethod, statementArgs) -> {
        if (statementMethod.equals("param")) {
          parameters.put(String.valueOf(statementArgs[0]), statementArgs[1]);
          return statementReference.get();
        }
        if (!statementMethod.equals("query")) return null;
        mapperReference.set((RowMapper<Map<String, Object>>) statementArgs[0]);
        return proxy(JdbcClient.MappedQuerySpec.class, (queryMethod, queryArgs) ->
            queryMethod.equals("list") ? List.of(mapperReference.get().mapRow(row, 0)) : null);
      });
      statementReference.set(statement);
      return statement;
    });
    return new BusinessController(db, null, null, null);
  }

  private static ResultSet row(Map<String, Object> values) {
    return proxy(ResultSet.class, (method, args) -> {
      Object value = values.get(args[0]);
      if (method.equals("getObject") && args.length == 2) return value;
      if (method.equals("getString") || method.equals("getBigDecimal") || method.equals("getBoolean")) return value;
      return null;
    });
  }

  @SuppressWarnings("unchecked")
  private static <T> T proxy(Class<T> type, Invocation invocation) {
    return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type},
        (instance, method, args) -> invocation.invoke(method.getName(), args == null ? new Object[0] : args));
  }

  @FunctionalInterface
  private interface Invocation {
    Object invoke(String method, Object[] args) throws Throwable;
  }
}
