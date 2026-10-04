package com.mathan.erp.master;

import com.fasterxml.jackson.databind.JsonNode;
import com.mathan.erp.security.UserPrincipal;
import com.mathan.erp.tenant.TenantService;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/masters/{type}")
public class MasterController {
  private final MasterService masters; private final TenantService tenants;
  public MasterController(MasterService masters,TenantService tenants){this.masters=masters;this.tenants=tenants;}
  @GetMapping List<Map<String,Object>> list(@PathVariable String type,@RequestHeader("X-Business-Id")String h,@AuthenticationPrincipal UserPrincipal u){return masters.list(type,tenants.require(u,h,permission(type)).businessId());}
  @PostMapping Map<String,Object> create(@PathVariable String type,@RequestHeader("X-Business-Id")String h,@AuthenticationPrincipal UserPrincipal u,@RequestBody JsonNode body){var t=tenants.require(u,h,permission(type));return masters.create(type,t.businessId(),body);}
  @PutMapping("/{id}") Map<String,Object> update(@PathVariable String type,@PathVariable UUID id,@RequestHeader("X-Business-Id")String h,@AuthenticationPrincipal UserPrincipal u,@RequestBody JsonNode body){var t=tenants.require(u,h,permission(type));if("account-groups".equals(type)&&body.hasNonNull("nature"))masters.validateAccountGroupNature(id,t.businessId(),body.get("nature").asText());return masters.update(type,id,t.businessId(),body);}
  @DeleteMapping("/{id}") void delete(@PathVariable String type,@PathVariable UUID id,@RequestHeader("X-Business-Id")String h,@AuthenticationPrincipal UserPrincipal u){var t=tenants.require(u,h,permission(type));masters.delete(type,id,t.businessId());}
  private String permission(String type){return "periods".equals(type)?"settings":"masters";}
}
