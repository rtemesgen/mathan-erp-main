package com.mathan.erp.voucher;

import java.math.BigDecimal;

/** Moving-average inventory valuation for one product/warehouse balance. */
final class StockCosting {
  private StockCosting() {}

  record Balance(BigDecimal quantity, BigDecimal inventoryValue) {}
  record Movement(Balance balance, BigDecimal costValue) {}

  static Movement apply(Balance current, BigDecimal quantity, BigDecimal rate, boolean allowNegative) {
    BigDecimal nextQuantity = current.quantity().add(quantity);
    if (!allowNegative && nextQuantity.signum() < 0) return null;
    BigDecimal unitCost = current.quantity().signum() > 0
        ? current.inventoryValue().divide(current.quantity(), 12, java.math.RoundingMode.HALF_UP)
        : rate;
    BigDecimal movementValue = quantity.signum() >= 0 ? quantity.multiply(rate) : quantity.multiply(unitCost);
    BigDecimal nextValue = current.inventoryValue().add(movementValue);
    if (nextQuantity.signum() == 0) nextValue = BigDecimal.ZERO;
    return new Movement(new Balance(nextQuantity, nextValue), movementValue);
  }

  static BigDecimal averageCost(Balance balance) {
    return balance.quantity().signum() == 0
        ? BigDecimal.ZERO
        : balance.inventoryValue().abs().divide(balance.quantity().abs(), 12, java.math.RoundingMode.HALF_UP);
  }
}
