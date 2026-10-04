package com.mathan.erp.master;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class MasterServiceTest {
  private final ObjectMapper json = new ObjectMapper();

  @Test
  void rejectsMissingRequiredCurrencyFieldsBeforeDatabaseWrite() throws Exception {
    assertThatThrownBy(() -> MasterService.validateCreate("currencies", json.readTree("{\"code\":\"USD\"}")))
        .hasMessageContaining("name is required");
  }

  @Test
  void rejectsMissingRequiredProductUnitBeforeDatabaseWrite() throws Exception {
    assertThatThrownBy(() -> MasterService.validateCreate("products", json.readTree("{\"name\":\"Rice\"}")))
        .hasMessageContaining("baseUnitId is required");
  }

  @Test
  void rejectsWhitespaceInUpdatedMasterNames() throws Exception {
    assertThatThrownBy(() -> MasterService.validateUpdate("units", json.readTree("{\"name\":\"   \"}")))
        .hasMessageContaining("name is required");
  }
}
