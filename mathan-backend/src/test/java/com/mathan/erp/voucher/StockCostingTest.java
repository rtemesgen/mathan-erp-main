package com.mathan.erp.voucher;

import static org.assertj.core.api.Assertions.assertThat;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class StockCostingTest {
  @Test
  void calculatesMovingAverageForReceiptsAndIssues() {
    var first = StockCosting.apply(new StockCosting.Balance(bd("0"), bd("0")), bd("10"), bd("5"), false);
    var second = StockCosting.apply(first.balance(), bd("10"), bd("9"), false);
    assertThat(second.balance().quantity()).isEqualByComparingTo("20");
    assertThat(second.balance().inventoryValue()).isEqualByComparingTo("140");
    assertThat(StockCosting.averageCost(second.balance())).isEqualByComparingTo("7");

    var issue = StockCosting.apply(second.balance(), bd("-4"), bd("100"), false);
    assertThat(issue.costValue()).isEqualByComparingTo("-28");
    assertThat(issue.balance().inventoryValue()).isEqualByComparingTo("112");
  }

  @Test
  void rejectsNegativeBalanceWhenPolicyDisallowsIt() {
    assertThat(StockCosting.apply(new StockCosting.Balance(bd("2"), bd("10")), bd("-3"), bd("5"), false)).isNull();
  }

  private static BigDecimal bd(String value) { return new BigDecimal(value); }
}
