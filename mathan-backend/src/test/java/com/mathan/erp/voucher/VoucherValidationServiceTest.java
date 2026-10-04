package com.mathan.erp.voucher;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class VoucherValidationServiceTest {
  private final ObjectMapper json = new ObjectMapper();

  @Test
  void rejectsMissingFinancialLines() throws Exception {
    assertThatThrownBy(() -> VoucherValidationService.validateLines(json.readTree("[]"), json.readTree("[]")))
        .hasMessageContaining("At least one voucher line");
  }

  @Test
  void permitsStockOnlyLines() throws Exception {
    VoucherValidationService.validateLines(json.readTree("[]"), json.readTree("[{\"productId\":\"00000000-0000-0000-0000-000000000001\",\"warehouseId\":\"00000000-0000-0000-0000-000000000002\",\"unitId\":\"00000000-0000-0000-0000-000000000003\",\"quantity\":1}]"));
  }

  @Test
  void rejectsMalformedStockOnlyLines() throws Exception {
    assertThatThrownBy(() -> VoucherValidationService.validateLines(json.readTree("[]"), json.readTree("[{\"productId\":\"00000000-0000-0000-0000-000000000001\",\"warehouseId\":\"00000000-0000-0000-0000-000000000002\",\"unitId\":\"00000000-0000-0000-0000-000000000003\",\"quantity\":0}]")))
        .hasMessageContaining("Stock quantity");
    assertThatThrownBy(() -> VoucherValidationService.validateLines(json.readTree("[]"), json.readTree("[{\"quantity\":1,\"productId\":\"\"}]")))
        .hasMessageContaining("productId");
  }

  @Test
  void rejectsAZeroOrTwoSidedLine() throws Exception {
    assertThatThrownBy(() -> VoucherValidationService.validateLines(json.readTree("[{\"debit\":0,\"credit\":0}]"), json.readTree("[]")))
        .hasMessageContaining("either a positive debit or a positive credit");
    assertThatThrownBy(() -> VoucherValidationService.validateLines(json.readTree("[{\"debit\":1,\"credit\":1}]"), json.readTree("[]")))
        .hasMessageContaining("either a positive debit or a positive credit");
  }

  @Test
  void capsCombinedSettlementLinesAtTheOpenReference() {
    assertThat(VoucherService.settlementFits(new BigDecimal("100"), new BigDecimal("40"), new BigDecimal("60"))).isTrue();
    assertThat(VoucherService.settlementFits(new BigDecimal("100"), new BigDecimal("40"), new BigDecimal("61"))).isFalse();
  }
}
