package com.mathan.erp.tenant;

import com.mathan.erp.api.ApiException;
import com.mathan.erp.security.UserPrincipal;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class TenantService {
  private final JdbcClient db;
  public TenantService(JdbcClient db){this.db=db;}
  public Membership require(UserPrincipal user,String raw,String permission){
    if(raw==null)throw new ApiException(HttpStatus.BAD_REQUEST,"BUSINESS_REQUIRED","X-Business-Id header is required");
    UUID business;try{business=UUID.fromString(raw);}catch(Exception e){throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_BUSINESS","Invalid business identifier");}
    Membership m=db.sql("select m.business_id,m.role,m.masters,m.transactions,m.reports,m.audit,m.users,m.settings,b.allow_negative_inventory from membership m join business b on b.id=m.business_id where m.user_id=:u and m.business_id=:b and m.active")
      .param("u",user.id()).param("b",business).query((rs,n)->new Membership(business,rs.getString("role"),Map.of("masters",rs.getBoolean("masters"),"transactions",rs.getBoolean("transactions"),"reports",rs.getBoolean("reports"),"audit",rs.getBoolean("audit"),"users",rs.getBoolean("users"),"settings",rs.getBoolean("settings")),rs.getBoolean("allow_negative_inventory"))).optional()
      .orElseThrow(()->new ApiException(HttpStatus.FORBIDDEN,"BUSINESS_ACCESS_DENIED","You do not have access to this business"));
    if(permission!=null&&!m.allowed(permission))throw new ApiException(HttpStatus.FORBIDDEN,"PERMISSION_DENIED","Required permission: "+permission);
    return m;
  }
  public record Membership(UUID businessId,String role,Map<String,Boolean> permissions,boolean allowNegativeInventory){public boolean allowed(String p){return "admin".equals(role)||Boolean.TRUE.equals(permissions.get(p));}}
}

