package com.mathan.erp.voucher;

import com.fasterxml.jackson.databind.JsonNode;
import com.mathan.erp.api.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class VoucherValidationService {
  private static final Set<String> TYPES=Set.of("Purchase","Sale","Journal","PurchaseReturn","SalesReturn","StockAdjustment","StockTransfer","Payment","Receipt","Contra","Payroll");
  private final JdbcClient db;
  public VoucherValidationService(JdbcClient db){this.db=db;}
  public record ValidatedVoucher(String type,LocalDate date,BigDecimal exchangeRate){}

  public ValidatedVoucher validateForPost(java.util.UUID business,JsonNode body){
    String type=required(body,"type");if(!TYPES.contains(type))throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_VOUCHER_TYPE","Unsupported voucher type");
    LocalDate date;try{date=LocalDate.parse(required(body,"date"));}catch(DateTimeParseException e){throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","date must be a valid ISO date");}
    Boolean closed=db.sql("select closed from period where business_id=:b and :d between start_date and end_date order by start_date desc limit 1").param("b",business).param("d",date).query(Boolean.class).optional().orElseThrow(()->new ApiException(HttpStatus.BAD_REQUEST,"PERIOD_REQUIRED","An accounting period must cover the voucher date"));
    if(closed)throw new ApiException(HttpStatus.CONFLICT,"PERIOD_CLOSED","The accounting period is closed");
    JsonNode lines=body.path("lines"),stock=body.path("stockLines");validateLines(lines,stock);
    BigDecimal rate=decimal(body,"exchangeRate",BigDecimal.ONE);if(rate.signum()<=0)throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_EXCHANGE_RATE","exchangeRate must be positive");
    return new ValidatedVoucher(type,date,rate);
  }

  static void validateLines(JsonNode lines,JsonNode stock){
    validateStock(stock);
    if(!lines.isArray()||lines.isEmpty()){if(stock.isArray()&&!stock.isEmpty())return;throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","At least one voucher line or stock line is required");}
    BigDecimal debitTotal=BigDecimal.ZERO,creditTotal=BigDecimal.ZERO;
    for(JsonNode line:lines){BigDecimal debit=decimal(line,"debit",BigDecimal.ZERO),credit=decimal(line,"credit",BigDecimal.ZERO);if(debit.signum()<0||credit.signum()<0||debit.signum()>0&&credit.signum()>0||debit.signum()==0&&credit.signum()==0)throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_VOUCHER_LINE","Each line must contain either a positive debit or a positive credit");debitTotal=debitTotal.add(debit);creditTotal=creditTotal.add(credit);}
    if(debitTotal.signum()==0||debitTotal.compareTo(creditTotal)!=0)throw new ApiException(HttpStatus.BAD_REQUEST,"UNBALANCED_VOUCHER","Voucher debits and credits must balance");
  }
  private static void validateStock(JsonNode stock){
    if(stock==null||stock.isMissingNode()||stock.isNull())return;
    if(!stock.isArray())throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","stockLines must be an array");
    for(JsonNode line:stock){
      for(String key:new String[]{"productId","warehouseId","unitId"}){if(!line.hasNonNull(key)||line.get(key).asText().isBlank())throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR",key+" is required for stock lines");try{java.util.UUID.fromString(line.get(key).asText());}catch(IllegalArgumentException e){throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_IDENTIFIER",key+" must be a valid identifier");}}
      BigDecimal quantity=decimal(line,"quantity",BigDecimal.ZERO);if(quantity.signum()==0)throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_STOCK_LINE","Stock quantity cannot be zero");
      BigDecimal rate=decimal(line,"rate",BigDecimal.ZERO);if(rate.signum()<0)throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_STOCK_LINE","Stock rate cannot be negative");
    }
  }
  private static BigDecimal decimal(JsonNode n,String key,BigDecimal fallback){try{return n.hasNonNull(key)?n.get(key).decimalValue():fallback;}catch(RuntimeException e){throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_AMOUNT",key+" must be a valid number");}}
  private static String required(JsonNode n,String key){if(!n.hasNonNull(key)||n.get(key).asText().isBlank())throw new ApiException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR",key+" is required");return n.get(key).asText();}
}
