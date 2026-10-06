package com.mathan.erp.tenant;

import com.mathan.erp.api.ApiException;
import com.mathan.erp.chart.ChartService;
import com.mathan.erp.security.UserPrincipal;
import com.mathan.erp.validation.ReferenceIntegrityService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/businesses")
public class BusinessController {
  private final JdbcClient db; private final TenantService tenants; private final ChartService charts; private final ReferenceIntegrityService refs;
  public BusinessController(JdbcClient db,TenantService tenants,ChartService charts,ReferenceIntegrityService refs){this.db=db;this.tenants=tenants;this.charts=charts;this.refs=refs;}
  public record Create(@NotBlank String name,String baseCurrencyCode){}
  @GetMapping List<?> list(@AuthenticationPrincipal UserPrincipal u){return db.sql("select b.id,b.name,b.base_currency_id,c.code base_currency_code,c.name base_currency_name,c.symbol base_currency_symbol,c.exchange_rate base_currency_exchange_rate,c.active base_currency_active,b.allow_negative_inventory from business b join membership m on m.business_id=b.id left join currency c on c.id=b.base_currency_id where m.user_id=:u and m.active order by b.name").param("u",u.id()).query((rs,n)->businessResponse(rs.getObject("id",UUID.class),rs.getString("name"),rs.getObject("base_currency_id",UUID.class),rs.getString("base_currency_code"),rs.getString("base_currency_name"),rs.getString("base_currency_symbol"),rs.getBigDecimal("base_currency_exchange_rate"),rs.getBoolean("base_currency_active"),rs.getBoolean("allow_negative_inventory"))).list();}
  @PostMapping @Transactional Map<String,Object> create(@AuthenticationPrincipal UserPrincipal u,@Valid @RequestBody Create r){
    UUID business=UUID.randomUUID(); String code=r.baseCurrencyCode()==null?"USD":r.baseCurrencyCode().toUpperCase(Locale.ROOT);
    if(!STANDARD_CURRENCIES.containsKey(code))throw new ApiException(HttpStatus.BAD_REQUEST,"UNSUPPORTED_CURRENCY","Choose one of: USD, UGX, KES, SSP");
    db.sql("insert into business(id,name,owner_user_id) values(:id,:n,:u)").param("id",business).param("n",r.name()).param("u",u.id()).update();
    UUID baseCurrency=null;
    for(var entry:STANDARD_CURRENCIES.entrySet()){
      UUID id=UUID.randomUUID(); String[] definition=entry.getValue();
      db.sql("insert into currency(id,business_id,code,name,symbol,exchange_rate) values(:id,:b,:c,:n,:s,1)").param("id",id).param("b",business).param("c",entry.getKey()).param("n",definition[0]).param("s",definition[1]).update();
      if(entry.getKey().equals(code))baseCurrency=id;
    }
    db.sql("update business set base_currency_id=:c where id=:b").param("c",baseCurrency).param("b",business).update();
    db.sql("insert into membership(user_id,business_id,role,masters,transactions,reports,audit,users,settings) values(:u,:b,'admin',true,true,true,true,true,true)").param("u",u.id()).param("b",business).update();
    for(var group:List.of(Map.entry("Fixed Assets","Asset"),Map.entry("Current Assets","Asset"),Map.entry("Sundry Debtors","Asset"),Map.entry("Sundry Creditors","Liability"),Map.entry("Bank & Cash","Asset"),Map.entry("Direct Income","Income"),Map.entry("Direct Expense","Expense"),Map.entry("Capital Account","Equity")))
      db.sql("insert into account_group(business_id,name,nature) values(:b,:n,:x)").param("b",business).param("n",group.getKey()).param("x",group.getValue()).update();
    charts.seedDefaults(business);
    db.sql("insert into audit_log(business_id,actor_id,action,entity_type,entity_id,details) values(:b,:u,'Business created','business',:b,:d)").param("b",business).param("u",u.id()).param("d",r.name()).update();
    String[] baseCurrencyDefinition=STANDARD_CURRENCIES.get(code);
    return businessResponse(business,r.name(),baseCurrency,code,baseCurrencyDefinition[0],baseCurrencyDefinition[1],BigDecimal.ONE,true,false);
  }
  @PatchMapping("/{id}/settings") int settings(@PathVariable UUID id,@RequestHeader("X-Business-Id")String h,@AuthenticationPrincipal UserPrincipal u,@RequestBody Map<String,Object> body){
    var tenant=tenants.require(u,h,"settings");
    if(!tenant.businessId().equals(id))throw new ApiException(HttpStatus.FORBIDDEN,"BUSINESS_ACCESS_DENIED","The active business must match the updated business");
    UUID currencyId=null;
    if(body.containsKey("baseCurrencyId")){
      try{currencyId=UUID.fromString(String.valueOf(body.get("baseCurrencyId")));}catch(Exception e){throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_CURRENCY","Invalid base currency identifier");}
      refs.requireCurrency(id,currencyId,true);
    }
    String name=body.containsKey("name")?String.valueOf(body.get("name")).trim():null;
    if(name!=null&&name.isBlank())throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_BUSINESS_NAME","Business name cannot be blank");
    Boolean allow=body.containsKey("allowNegativeInventory")?Boolean.valueOf(String.valueOf(body.get("allowNegativeInventory"))):null;
    return db.sql("update business set name=coalesce(:n,name),base_currency_id=coalesce(:c,base_currency_id),allow_negative_inventory=coalesce(:a,allow_negative_inventory),updated_at=now(),version=version+1 where id=:id")
      .param("n",name).param("c",currencyId,java.sql.Types.OTHER).param("a",allow,java.sql.Types.BOOLEAN).param("id",id).update();
  }
  private static final Map<String,String[]> STANDARD_CURRENCIES=Map.of(
    "USD",new String[]{"US Dollar","$"},"UGX",new String[]{"Uganda Shilling","USh"},
    "KES",new String[]{"Kenyan Shilling","KSh"},"SSP",new String[]{"South Sudanese Pound","SSP"}
  );

  static Map<String,Object> businessResponse(UUID id,String name,UUID baseCurrencyId,String code,String currencyName,String symbol,BigDecimal exchangeRate,boolean currencyActive,boolean allowNegativeInventory){
    Map<String,Object> response=new LinkedHashMap<>();
    response.put("id",id);
    response.put("name",name);
    response.put("baseCurrencyId",Optional.ofNullable(baseCurrencyId).map(Object::toString).orElse(""));
    response.put("baseCurrencyCode",Optional.ofNullable(code).orElse(""));
    response.put("allowNegativeInventory",allowNegativeInventory);
    response.put("baseCurrency",baseCurrencyId==null?null:Map.of("id",baseCurrencyId,"code",code,"name",currencyName,"symbol",symbol,"exchangeRate",exchangeRate,"active",currencyActive));
    return response;
  }
}
