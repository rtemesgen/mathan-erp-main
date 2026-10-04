package com.mathan.erp.chart;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathan.erp.security.UserPrincipal;
import com.mathan.erp.voucher.VoucherService;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest
@EnabledIfSystemProperty(named = "run.integration", matches = "true")
class ChartServiceIntegrationTest {
  static final boolean EXTERNAL = "true".equals(System.getProperty("integration.external"));
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");
  static { if ("true".equals(System.getProperty("run.integration")) && !EXTERNAL) POSTGRES.start(); }
  @AfterAll static void stopContainer() { if (!EXTERNAL && POSTGRES.isRunning()) POSTGRES.stop(); }

  @DynamicPropertySource
  static void postgresProperties(DynamicPropertyRegistry registry) {
    if (EXTERNAL) return;
    registry.add("SPRING_DATASOURCE_URL", POSTGRES::getJdbcUrl);
    registry.add("SPRING_DATASOURCE_USERNAME", POSTGRES::getUsername);
    registry.add("SPRING_DATASOURCE_PASSWORD", POSTGRES::getPassword);
    registry.add("MATHAN_JWT_SECRET", () -> "integration-test-secret-that-is-long-enough");
    registry.add("MATHAN_COOKIE_SECURE", () -> "false");
    registry.add("MATHAN_BOOTSTRAP_USERNAME", () -> "integration-admin");
    registry.add("MATHAN_BOOTSTRAP_PIN", () -> "1234");
  }

  @Autowired ChartService charts;
  @Autowired VoucherService vouchers;
  @Autowired JdbcClient db;

  @Test
  void seedsExactlyTheDefinedChartAndIsIdempotent() {
    UUID user = UUID.randomUUID();
    UUID business = UUID.randomUUID();
    db.sql("insert into app_user(id,username,display_name,pin_hash) values(:u,:n,'Test', 'hash')").param("u", user).param("n", "chart-" + user).update();
    db.sql("insert into business(id,name,owner_user_id) values(:b,'Chart Test',:u)").param("b", business).param("u", user).update();

    var first = charts.seedDefaults(business);
    var second = charts.seedDefaults(business);

    assertThat(first.created()).isEqualTo(20);
    assertThat(second.created()).isZero();
    assertThat(db.sql("select count(*) from ledger where business_id=:b").param("b", business).query(Long.class).single()).isEqualTo(20);
    assertThat(db.sql("select count(*) from ledger where business_id=:b and account_code in ('1400','3100')").param("b", business).query(Long.class).single()).isEqualTo(2);
    assertThat(db.sql("select count(*) from information_schema.columns where table_name='stock_balance' and column_name in ('inventory_value','average_cost','costing_basis')").query(Long.class).single()).isEqualTo(3);
    assertThat(db.sql("select count(*) from information_schema.columns where table_name='stock_movement' and column_name='cost_value'").query(Long.class).single()).isEqualTo(1);
    assertThat(charts.list(business)).allSatisfy(row -> {
      assertThat(row.get("accountCode")).isNotNull();
      assertThat(row.get("nature")).isNotNull();
      assertThat(row.get("normalBalance")).isNotNull();
    });
  }

  @Test
  void postsMovingAverageCostAndAutomaticCogs() throws Exception {
    UUID user = UUID.randomUUID();
    UUID business = UUID.randomUUID();
    UserPrincipal principal = new UserPrincipal(user, "costing-" + user);
    db.sql("insert into app_user(id,username,display_name,pin_hash) values(:u,:n,'Test', 'hash')").param("u", user).param("n", principal.username()).update();
    db.sql("insert into business(id,name,owner_user_id) values(:b,'Costing Test',:u)").param("b", business).param("u", user).update();
    db.sql("insert into membership(user_id,business_id,role,masters,transactions,reports,audit,users,settings) values(:u,:b,'admin',true,true,true,true,true,true)").param("u", user).param("b", business).update();
    UUID currency = UUID.randomUUID();
    db.sql("insert into currency(id,business_id,code,name,symbol,exchange_rate) values(:c,:b,'USD','US Dollar','$',1)").param("c", currency).param("b", business).update();
    db.sql("update business set base_currency_id=:c where id=:b").param("c", currency).param("b", business).update();
    db.sql("insert into period(business_id,name,start_date,end_date) values(:b,'FY 2026','2026-01-01','2026-12-31')").param("b", business).update();
    charts.seedDefaults(business);
    UUID unit = UUID.randomUUID(), warehouse = UUID.randomUUID(), product = UUID.randomUUID();
    db.sql("insert into unit(id,business_id,name) values(:id,:b,'Each')").param("id", unit).param("b", business).update();
    db.sql("insert into warehouse(id,business_id,name) values(:id,:b,'Main')").param("id", warehouse).param("b", business).update();
    db.sql("insert into product(id,business_id,name,base_unit_id) values(:id,:b,'Test Item',:u)").param("id", product).param("b", business).param("u", unit).update();
    UUID inventory = ledger(business, "1400"), payables = ledger(business, "4100"), receivables = ledger(business, "1300"), sales = ledger(business, "2100"), cogs = ledger(business, "3100");
    ObjectMapper json = new ObjectMapper();
    vouchers.create(principal, business.toString(), json.readTree("{\"type\":\"Purchase\",\"date\":\"2026-03-01\",\"currencyId\":\""+currency+"\",\"exchangeRate\":1,\"lines\":[{\"ledgerId\":\""+inventory+"\",\"debit\":100},{\"ledgerId\":\""+payables+"\",\"credit\":100}],\"stockLines\":[{\"productId\":\""+product+"\",\"warehouseId\":\""+warehouse+"\",\"unitId\":\""+unit+"\",\"quantity\":10,\"rate\":10}]}"));
    var sale = vouchers.create(principal, business.toString(), json.readTree("{\"type\":\"Sale\",\"date\":\"2026-03-02\",\"currencyId\":\""+currency+"\",\"exchangeRate\":1,\"lines\":[{\"ledgerId\":\""+receivables+"\",\"debit\":100},{\"ledgerId\":\""+sales+"\",\"credit\":100}],\"stockLines\":[{\"productId\":\""+product+"\",\"warehouseId\":\""+warehouse+"\",\"unitId\":\""+unit+"\",\"quantity\":-4,\"rate\":25}]}"));
    Map<String, BigDecimal> balance = db.sql("select quantity,inventory_value,average_cost from stock_balance where business_id=:b and product_id=:p and warehouse_id=:w").param("b", business).param("p", product).param("w", warehouse).query((rs,n)->Map.of("quantity",rs.getBigDecimal(1),"value",rs.getBigDecimal(2),"average",rs.getBigDecimal(3))).single();
    assertThat(balance.get("quantity")).isEqualTo(new BigDecimal("6.0000"));
    assertThat(balance.get("value")).isEqualTo(new BigDecimal("60.0000"));
    assertThat(db.sql("select count(*) from voucher_line where voucher_id=:v and ledger_id=:l and debit=40").param("v", sale.get("id")).param("l", cogs).query(Long.class).single()).isEqualTo(1);
  }

  private UUID ledger(UUID business, String code) {
    return db.sql("select id from ledger where business_id=:b and account_code=:c").param("b", business).param("c", code).query(UUID.class).single();
  }
}
