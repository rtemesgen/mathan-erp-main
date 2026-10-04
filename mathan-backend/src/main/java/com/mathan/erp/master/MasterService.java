package com.mathan.erp.master;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.mathan.erp.api.ApiException;
import com.mathan.erp.chart.ChartService;
import com.mathan.erp.validation.ReferenceIntegrityService;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class MasterService {
  private final NamedParameterJdbcTemplate db; private final ChartService charts; private final ReferenceIntegrityService refs;
  public MasterService(JdbcTemplate db,ChartService charts,ReferenceIntegrityService refs){this.db=new NamedParameterJdbcTemplate(db);this.charts=charts;this.refs=refs;}
  record Def(String table,LinkedHashMap<String,String> fields){}
  private Def def(String type){return switch(type){
    case "currencies"->d("currency","code","code","name","name","symbol","symbol","exchangeRate","exchange_rate","active","active");
    case "periods"->d("period","name","name","startDate","start_date","endDate","end_date","isClosed","closed");
    case "account-groups"->d("account_group","name","name","nature","nature","active","active");
    case "ledgers"->d("ledger","accountCode","account_code","name","name","groupId","group_id","parentLedgerId","parent_ledger_id","isSystem","system","openingBalance","opening_balance","openingBalanceType","opening_balance_type","active","active");
    case "parties"->d("party","name","name","type","type","ledgerId","ledger_id","active","active");
    case "units"->d("unit","name","name","active","active"); case "warehouses"->d("warehouse","name","name","active","active");
    case "products"->d("product","name","name","baseUnitId","base_unit_id","sellingPrice","selling_price","active","active");
    case "employees"->d("employee","name","name","designation","designation","basicSalary","basic_salary","joinDate","join_date","active","active");
    case "cost-centers"->d("cost_center","name","name","active","active");
    default->throw new ApiException(HttpStatus.NOT_FOUND,"UNKNOWN_RESOURCE","Unknown master resource");};}
  private Def d(String table,String...pairs){var m=new LinkedHashMap<String,String>();for(int i=0;i<pairs.length;i+=2)m.put(pairs[i],pairs[i+1]);return new Def(table,m);}
  public List<Map<String,Object>> list(String type,UUID business){Def d=def(type);if("ledgers".equals(type))return charts.list(business);String cols=d.fields.entrySet().stream().map(e->e.getValue()+" as \""+e.getKey()+"\"").reduce("id",(a,b)->a+","+b);return db.queryForList("select "+cols+" from "+d.table+" where business_id=:b order by name",Map.of("b",business));}
  public Map<String,Object> create(String type,UUID business,JsonNode body){Def d=def(type);validateCreate(type,body);if("periods".equals(type))validatePeriod(body,null,business);JsonNode payload=body;if("ledgers".equals(type)&&!body.hasNonNull("accountCode")){UUID group=uuid(body,"groupId");payload=body.deepCopy();((ObjectNode)payload).put("accountCode",charts.allocateCode(business,group));}final JsonNode data=payload;validateReferences(type,business,data);if("ledgers".equals(type))charts.validateLedger(business,data,null);UUID id=UUID.randomUUID();var p=new MapSqlParameterSource("id",id).addValue("b",business);List<String> cols=new ArrayList<>(List.of("id","business_id")),vals=new ArrayList<>(List.of(":id",":b"));d.fields.forEach((json,col)->{if(data.has(json)){cols.add(col);vals.add(":"+col);p.addValue(col,value(data.get(json),col));}});db.update("insert into "+d.table+"("+String.join(",",cols)+") values("+String.join(",",vals)+")",p);return "ledgers".equals(type)?charts.get(business,id):get(d,id,business);}
  public Map<String,Object> update(String type,UUID id,UUID business,JsonNode body){Def d=def(type);validateUpdate(type,body);if("periods".equals(type))validatePeriod(body,id,business);if("account-groups".equals(type)&&body.hasNonNull("nature"))validateAccountGroupNature(id,business,body.get("nature").asText());validateReferences(type,business,body);if("ledgers".equals(type)&&(body.has("accountCode")||body.has("groupId")||body.has("parentLedgerId")))charts.validateLedger(business,body,id);var p=new MapSqlParameterSource("id",id).addValue("b",business);List<String> sets=new ArrayList<>();d.fields.forEach((json,col)->{if(body.has(json)){sets.add(col+"=:"+col);p.addValue(col,value(body.get(json),col));}});if(sets.isEmpty())return "ledgers".equals(type)?charts.get(business,id):get(d,id,business);sets.add("version=version+1");int n=db.update("update "+d.table+" set "+String.join(",",sets)+" where id=:id and business_id=:b",p);if(n==0)notFound();return "ledgers".equals(type)?charts.get(business,id):get(d,id,business);}
  private void validatePeriod(JsonNode body,UUID id,UUID business){
    if(id!=null&&(body.has("startDate")||body.has("endDate"))){Boolean closed=db.query("select closed from period where id=:id and business_id=:b",Map.of("id",id,"b",business),(rs,n)->rs.getBoolean(1)).stream().findFirst().orElseThrow(this::notFoundException);if(closed)throw new ApiException(HttpStatus.CONFLICT,"PERIOD_CLOSED","Closed period dates cannot be changed");}
    if(!body.has("startDate")&&!body.has("endDate"))return;
    LocalDate start;LocalDate end;
    try{start=body.has("startDate")?LocalDate.parse(body.get("startDate").asText()):db.query("select start_date from period where id=:id and business_id=:b",Map.of("id",id,"b",business),(rs,n)->rs.getObject(1,LocalDate.class)).stream().findFirst().orElseThrow(this::notFoundException);end=body.has("endDate")?LocalDate.parse(body.get("endDate").asText()):db.query("select end_date from period where id=:id and business_id=:b",Map.of("id",id,"b",business),(rs,n)->rs.getObject(1,LocalDate.class)).stream().findFirst().orElseThrow(this::notFoundException);}catch(DateTimeParseException e){throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PERIOD","Period dates must be valid ISO dates");}
    if(end.isBefore(start))throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PERIOD","endDate must be on or after startDate");
    var overlapParams=new MapSqlParameterSource().addValue("b",business).addValue("startDate",start).addValue("endDate",end);String idClause="";if(id!=null){idClause=" and id<>:id";overlapParams.addValue("id",id);}Boolean overlap=db.query("select exists(select 1 from period where business_id=:b and start_date<=:endDate and end_date>=:startDate"+idClause+"))",overlapParams,(rs,n)->rs.getBoolean(1)).stream().findFirst().orElse(false);if(Boolean.TRUE.equals(overlap))throw new ApiException(HttpStatus.CONFLICT,"PERIOD_OVERLAP","Accounting periods cannot overlap");
  }
  private void validateReferences(String type,UUID business,JsonNode body){if("parties".equals(type)&&body.hasNonNull("ledgerId"))refs.requireLedger(business,uuid(body,"ledgerId"),true);if("products".equals(type)&&body.hasNonNull("baseUnitId"))refs.requireUnit(business,uuid(body,"baseUnitId"),true);}
  static void validateCreate(String type,JsonNode body){
    if(body==null||!body.isObject())throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Request body must be an object");
    String[] fields=switch(type){case "currencies"->new String[]{"code","name","symbol","exchangeRate"};case "periods"->new String[]{"name","startDate","endDate"};case "account-groups"->new String[]{"name","nature"};case "ledgers"->new String[]{"name","groupId"};case "parties"->new String[]{"name","type"};case "units","warehouses","cost-centers"->new String[]{"name"};case "products"->new String[]{"name","baseUnitId"};case "employees"->new String[]{"name"};default->new String[0];};for(String field:fields)required(body,field);
  }
  static void validateUpdate(String type,JsonNode body){
    if(body==null||!body.isObject())throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Request body must be an object");
    String[] fields=switch(type){case "currencies"->new String[]{"code","name","symbol"};case "account-groups","periods","ledgers","parties","units","warehouses","cost-centers","products","employees"->new String[]{"name"};default->new String[0];};
    for(String field:fields)if(body.has(field))required(body,field);
    if(body.has("exchangeRate")){try{if(new java.math.BigDecimal(body.get("exchangeRate").asText()).signum()<=0)throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_EXCHANGE_RATE","exchangeRate must be greater than zero");}catch(ApiException e){throw e;}catch(RuntimeException e){throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_EXCHANGE_RATE","exchangeRate must be a valid positive number");}}
  }
  public void validateAccountGroupNature(UUID groupId,UUID business,String nature){if(nature==null||nature.isBlank())return;long ledgers=db.query("select count(*) from ledger where group_id=:g and business_id=:b and active",Map.of("g",groupId,"b",business),(rs,n)->rs.getLong(1)).stream().findFirst().orElse(0L);if(ledgers>0){String current=db.query("select nature from account_group where id=:g and business_id=:b",Map.of("g",groupId,"b",business),(rs,n)->rs.getString(1)).stream().findFirst().orElseThrow(this::notFoundException);if(!current.equals(nature))throw new ApiException(HttpStatus.CONFLICT,"ACCOUNT_GROUP_IN_USE","Cannot change the nature of a group that has active ledgers");}}
  public void delete(String type,UUID id,UUID business){Def d=def(type);if("ledgers".equals(type)){Boolean system=db.query("select system from ledger where id=:id and business_id=:b",Map.of("id",id,"b",business),(rs,n)->rs.getBoolean(1)).stream().findFirst().orElseThrow(this::notFoundException);if(Boolean.TRUE.equals(system))throw new ApiException(HttpStatus.CONFLICT,"SYSTEM_LEDGER","System ledgers cannot be deleted");}String sql="periods".equals(type)?"update "+d.table+" set closed=true,version=version+1 where id=:id and business_id=:b":"update "+d.table+" set active=false,version=version+1 where id=:id and business_id=:b";if(db.update(sql,Map.of("id",id,"b",business))==0)notFound();}
  private Map<String,Object> get(Def d,UUID id,UUID b){String cols=d.fields.entrySet().stream().map(e->e.getValue()+" as \""+e.getKey()+"\"").reduce("id",(a,x)->a+","+x);return db.queryForMap("select "+cols+" from "+d.table+" where id=:id and business_id=:b",Map.of("id",id,"b",b));}
  private Object value(JsonNode n,String col){if(n.isNull())return null;if(col.endsWith("_id"))return uuidText(n,col);if(col.contains("date"))return parseDate(n,col);if(n.isBoolean())return n.asBoolean();if(n.isNumber())return n.decimalValue();return n.asText();}
  private UUID uuid(JsonNode n,String key){try{return UUID.fromString(required(n,key));}catch(IllegalArgumentException e){throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_IDENTIFIER",key+" must be a valid identifier");}}
  private UUID uuidText(JsonNode n,String key){try{return UUID.fromString(n.asText());}catch(IllegalArgumentException e){throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_IDENTIFIER",key+" must be a valid identifier");}}
  private LocalDate parseDate(JsonNode n,String key){try{return LocalDate.parse(n.asText());}catch(DateTimeParseException e){throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_DATE",key+" must be a valid ISO date");}}
  private static String required(JsonNode n,String key){if(!n.hasNonNull(key)||n.get(key).asText().isBlank())throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR",key+" is required");return n.get(key).asText();}
  private void notFound(){throw new ApiException(HttpStatus.NOT_FOUND,"NOT_FOUND","Resource was not found");}
  private ApiException notFoundException(){return new ApiException(HttpStatus.NOT_FOUND,"NOT_FOUND","Resource was not found");}
}
