package com.mathan.erp.api;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.dao.DataIntegrityViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestControllerAdvice
public class ApiErrorHandler {
  private static final Logger log=LoggerFactory.getLogger(ApiErrorHandler.class);
  @ExceptionHandler(ApiException.class) ResponseEntity<?> api(ApiException e,HttpServletRequest r){return ResponseEntity.status(e.status()).body(body(e.status().value(),e.code(),e.getMessage(),Map.of(),r));}
  @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> validation(MethodArgumentNotValidException e,HttpServletRequest r){
    var fields=new java.util.LinkedHashMap<String,String>(); e.getBindingResult().getFieldErrors().forEach(x->fields.putIfAbsent(x.getField(),x.getDefaultMessage()));
    return ResponseEntity.badRequest().body(body(400,"VALIDATION_ERROR","Request validation failed",fields,r));
  }
  @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<?> integrity(DataIntegrityViolationException e,HttpServletRequest r){return ResponseEntity.badRequest().body(body(400,"DATA_INTEGRITY_ERROR","The requested change violates an accounting or master-data rule",Map.of(),r));}
  @ExceptionHandler(IllegalArgumentException.class) ResponseEntity<?> argument(IllegalArgumentException e,HttpServletRequest r){return ResponseEntity.badRequest().body(body(400,"INVALID_REQUEST","The request contains an invalid value",Map.of(),r));}
  @ExceptionHandler(Exception.class) ResponseEntity<?> unexpected(Exception e,HttpServletRequest r){log.error("Unhandled API error on {}",r.getRequestURI(),e);return ResponseEntity.internalServerError().body(body(500,"INTERNAL_ERROR","Unexpected server error",Map.of(),r));}
  private Map<String,Object> body(int status,String code,String message,Map<?,?> fields,HttpServletRequest r){return Map.of("status",status,"code",code,"message",message,"fieldErrors",fields,"timestamp",Instant.now(),"path",r.getRequestURI());}
}
