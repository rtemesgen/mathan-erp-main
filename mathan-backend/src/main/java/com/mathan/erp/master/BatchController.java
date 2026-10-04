package com.mathan.erp.master;

import com.fasterxml.jackson.databind.JsonNode;
import com.mathan.erp.security.UserPrincipal;
import com.mathan.erp.tenant.TenantService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import com.mathan.erp.api.ApiException;

@RestController
@RequestMapping("/api/v1/batch")
public class BatchController {
  private final MasterService masters;
  private final TenantService tenants;

  public BatchController(MasterService masters, TenantService tenants) {
    this.masters = masters;
    this.tenants = tenants;
  }

  public record Operation(
      String resource,
      String action,
      UUID id,
      JsonNode data) {}

  @PostMapping
  @Transactional
  public Map<String, Object> execute(
      @AuthenticationPrincipal UserPrincipal user,
      @RequestHeader("X-Business-Id") String header,
      @RequestBody Map<String, List<Operation>> body) {
    var tenant = tenants.require(user, header, "masters");
    var operations = body.getOrDefault("operations", List.of());
    if (operations.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_BATCH", "At least one batch operation is required");
    }
    if (operations.size() > 100) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "BATCH_TOO_LARGE", "A batch cannot contain more than 100 operations");
    }
    int completed = 0;
    for (var operation : operations) {
      String type = normalizeType(operation.resource());
      if ("delete".equals(operation.action())) {
        if (operation.id() == null) invalid("Delete operations require an id");
        masters.delete(type, operation.id(), tenant.businessId());
      } else if ("update".equals(operation.action())) {
        if (operation.id() == null) invalid("Update operations require an id");
        masters.update(type, operation.id(), tenant.businessId(), data(operation.data()));
      } else if ("create".equals(operation.action())) {
        masters.create(type, tenant.businessId(), data(operation.data()));
      } else {
        invalid("Unsupported batch action: " + operation.action());
      }
      completed++;
    }
    return Map.of("completed", completed);
  }

  private String normalizeType(String resource) {
    return switch (resource == null ? "" : resource) {
      case "accountGroups", "account-groups" -> "account-groups";
      case "costCenters", "cost-centers" -> "cost-centers";
      case "currencies" -> "currencies";
      case "periods" -> "periods";
      case "ledgers" -> "ledgers";
      case "parties" -> "parties";
      case "units" -> "units";
      case "warehouses" -> "warehouses";
      case "products" -> "products";
      case "employees" -> "employees";
      default -> throw new ApiException(HttpStatus.NOT_FOUND, "UNKNOWN_RESOURCE", "Unknown batch resource");
    };
  }

  private JsonNode data(JsonNode data) {
    if (data == null || data.isNull()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "BATCH_DATA_REQUIRED", "Batch data is required");
    }
    return data;
  }

  private void invalid(String message) {
    throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BATCH_OPERATION", message);
  }
}
