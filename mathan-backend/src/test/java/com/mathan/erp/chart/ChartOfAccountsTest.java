package com.mathan.erp.chart;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ChartOfAccountsTest {
  @Test
  void classifiesConfiguredRangesAndNormalBalances() {
    assertThat(ChartOfAccounts.classify("1100")).isEqualTo(ChartOfAccounts.AccountClass.ASSET);
    assertThat(ChartOfAccounts.classify("2100")).isEqualTo(ChartOfAccounts.AccountClass.INCOME);
    assertThat(ChartOfAccounts.classify("3100")).isEqualTo(ChartOfAccounts.AccountClass.EXPENSE);
    assertThat(ChartOfAccounts.classify("4100")).isEqualTo(ChartOfAccounts.AccountClass.LIABILITY);
    assertThat(ChartOfAccounts.classify("5100")).isEqualTo(ChartOfAccounts.AccountClass.EQUITY);
    assertThat(ChartOfAccounts.normalBalance(ChartOfAccounts.AccountNature.INCOME, "2100"))
        .isEqualTo(ChartOfAccounts.NormalBalance.CR);
    assertThat(ChartOfAccounts.normalBalance(ChartOfAccounts.AccountNature.EXPENSE, "3100"))
        .isEqualTo(ChartOfAccounts.NormalBalance.DR);
    assertThat(ChartOfAccounts.normalBalance(ChartOfAccounts.AccountNature.EQUITY, "5300"))
        .isEqualTo(ChartOfAccounts.NormalBalance.DR);
  }

  @Test
  void rejectsMalformedAndNatureMismatchedCodes() {
    assertThatThrownBy(() -> ChartOfAccounts.classify("999"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> ChartOfAccounts.classify("6000"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> ChartOfAccounts.validate("2100", ChartOfAccounts.AccountNature.EXPENSE))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> ChartOfAccounts.validate("31A0", ChartOfAccounts.AccountNature.EXPENSE))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void exposesTwentyDeterministicDefaultAccounts() {
    assertThat(ChartOfAccounts.defaults()).hasSize(20);
    assertThat(ChartOfAccounts.defaults()).anySatisfy(account -> {
      assertThat(account.code()).matches("[1-5][0-9]{3}");
      assertThat(account.name()).isNotBlank();
      assertThat(account.groupName()).isNotBlank();
      assertThat(account.nature()).isNotNull();
    });
    assertThat(ChartOfAccounts.defaults().stream().map(ChartOfAccounts.DefaultAccount::code))
        .contains("1100", "1400", "2100", "3100", "3600", "4100", "5100");
  }

  @Test
  void exposesAuthoritativeRangesForRendering() {
    assertThat(ChartOfAccounts.ranges()).extracting(ChartOfAccounts.RangeDefinition::fromCode)
        .containsExactly(1000, 2000, 3000, 4000, 5000);
    assertThat(ChartOfAccounts.ranges()).anyMatch(r -> r.accountClass() == ChartOfAccounts.AccountClass.EXPENSE
        && r.fromCode() == 3000 && r.toCode() == 3999);
  }
}
