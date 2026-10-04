package com.mathan.erp.chart;

import java.util.List;
import java.util.Objects;

/** Backend-owned accounting code rules shared by bootstrap and validation. */
public final class ChartOfAccounts {
  private ChartOfAccounts() {}

  public enum AccountClass {
    ASSET(1000, 1999),
    INCOME(2000, 2999),
    EXPENSE(3000, 3999),
    LIABILITY(4000, 4999),
    EQUITY(5000, 5999);

    private final int first;
    private final int last;

    AccountClass(int first, int last) {
      this.first = first;
      this.last = last;
    }

    boolean contains(int code) {
      return code >= first && code <= last;
    }
  }

  public enum AccountNature {
    ASSET,
    INCOME,
    EXPENSE,
    LIABILITY,
    EQUITY
  }

  public enum NormalBalance {
    DR,
    CR
  }

  public record RangeDefinition(AccountClass accountClass, int fromCode, int toCode,
                                NormalBalance normalBalance, String description) {}

  public record SubrangeDefinition(String key, int fromCode, int toCode, String description) {}

  public record DefaultAccount(
      String code,
      String name,
      String groupName,
      AccountNature nature,
      boolean system) {
    public DefaultAccount {
      Objects.requireNonNull(code);
      Objects.requireNonNull(name);
      Objects.requireNonNull(groupName);
      Objects.requireNonNull(nature);
    }
  }

  public static AccountClass classify(String accountCode) {
    if (accountCode == null || !accountCode.matches("[1-5][0-9]{3}")) {
      throw new IllegalArgumentException("Account code must be a four-digit code from 1000 to 5999");
    }
    int code = Integer.parseInt(accountCode);
    for (AccountClass accountClass : AccountClass.values()) {
      if (accountClass.contains(code)) return accountClass;
    }
    throw new IllegalArgumentException("Account code is outside the supported chart ranges");
  }

  public static void validate(String accountCode, AccountNature nature) {
    Objects.requireNonNull(nature, "Account nature is required");
    if (classify(accountCode).name().equals(nature.name())) return;
    throw new IllegalArgumentException(
        "Account code " + accountCode + " does not belong to nature " + nature);
  }

  public static NormalBalance normalBalance(AccountNature nature, String accountCode) {
    validate(accountCode, nature);
    if ("5300".equals(accountCode)) return NormalBalance.DR;
    return switch (nature) {
      case ASSET, EXPENSE -> NormalBalance.DR;
      case INCOME, LIABILITY, EQUITY -> NormalBalance.CR;
    };
  }

  public static List<RangeDefinition> ranges() {
    return List.of(
        new RangeDefinition(AccountClass.ASSET, 1000, 1999, NormalBalance.DR, "Cash, receivables, inventory and fixed assets"),
        new RangeDefinition(AccountClass.INCOME, 2000, 2999, NormalBalance.CR, "Sales, service and other income"),
        new RangeDefinition(AccountClass.EXPENSE, 3000, 3999, NormalBalance.DR, "Cost of sales and operating expenses"),
        new RangeDefinition(AccountClass.LIABILITY, 4000, 4999, NormalBalance.CR, "Payables, taxes, loans and other obligations"),
        new RangeDefinition(AccountClass.EQUITY, 5000, 5999, NormalBalance.CR, "Capital, retained earnings and drawings"));
  }

  public static List<SubrangeDefinition> subranges() {
    return List.of(
        new SubrangeDefinition("COGS", 3100, 3199, "Cost of sales and direct costs"),
        new SubrangeDefinition("OPERATING_EXPENSE", 3200, 3899, "Operating expenses"),
        new SubrangeDefinition("OTHER_EXPENSE", 3900, 3999, "Other expenses and adjustments"),
        new SubrangeDefinition("DRAWINGS_EXCEPTION", 5300, 5300, "Equity drawings have a debit normal balance"));
  }

  public static List<DefaultAccount> defaults() {
    return List.of(
        account("1100", "Cash on Hand", "Bank & Cash", AccountNature.ASSET),
        account("1110", "Petty Cash", "Bank & Cash", AccountNature.ASSET),
        account("1200", "Main Bank", "Bank & Cash", AccountNature.ASSET),
        account("1300", "Trade Receivables", "Sundry Debtors", AccountNature.ASSET),
        account("1400", "Inventory Control", "Current Assets", AccountNature.ASSET),
        account("1500", "Office Equipment", "Fixed Assets", AccountNature.ASSET),
        account("2100", "Sales Revenue", "Direct Income", AccountNature.INCOME),
        account("2200", "Other Income", "Direct Income", AccountNature.INCOME),
        account("3100", "Cost of Sales", "Direct Expense", AccountNature.EXPENSE),
        account("3200", "Payroll Expense", "Direct Expense", AccountNature.EXPENSE),
        account("3300", "Rent Expense", "Direct Expense", AccountNature.EXPENSE),
        account("3400", "Utilities Expense", "Direct Expense", AccountNature.EXPENSE),
        account("3500", "Office & Administration", "Direct Expense", AccountNature.EXPENSE),
        account("3600", "Depreciation Expense", "Direct Expense", AccountNature.EXPENSE),
        account("4100", "Trade Payables", "Sundry Creditors", AccountNature.LIABILITY),
        account("4200", "Tax Payable", "Sundry Creditors", AccountNature.LIABILITY),
        account("4300", "Loans Payable", "Sundry Creditors", AccountNature.LIABILITY),
        account("5100", "Share Capital", "Capital Account", AccountNature.EQUITY),
        account("5200", "Retained Earnings", "Capital Account", AccountNature.EQUITY),
        account("5300", "Drawings", "Capital Account", AccountNature.EQUITY));
  }

  private static DefaultAccount account(
      String code, String name, String groupName, AccountNature nature) {
    return new DefaultAccount(code, name, groupName, nature, true);
  }
}
