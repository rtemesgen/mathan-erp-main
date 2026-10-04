package com.mathan.erp.chart;

import com.mathan.erp.security.UserPrincipal;
import com.mathan.erp.tenant.TenantService;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Read-only contract for rendering the backend-owned chart in any client. */
@RestController
@RequestMapping("/api/v1/chart-of-accounts")
public class ChartController {
  private final TenantService tenants;
  public ChartController(TenantService tenants) { this.tenants = tenants; }

  @GetMapping
  Map<String,Object> definition(@AuthenticationPrincipal UserPrincipal user,
                                @RequestHeader("X-Business-Id") String header) {
    tenants.require(user, header, "masters");
    return Map.of("ranges", ChartOfAccounts.ranges(), "subranges", ChartOfAccounts.subranges(),
        "defaults", ChartOfAccounts.defaults());
  }
}
