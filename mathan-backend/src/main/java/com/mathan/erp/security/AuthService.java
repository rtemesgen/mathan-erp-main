package com.mathan.erp.security;

import com.mathan.erp.api.ApiException;
import com.mathan.erp.config.MathanProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private final JdbcClient db; private final PasswordEncoder encoder; private final JwtService jwt; private final MathanProperties props;
  private final SecureRandom random=new SecureRandom();
  public AuthService(JdbcClient db,PasswordEncoder encoder,JwtService jwt,MathanProperties props){this.db=db;this.encoder=encoder;this.jwt=jwt;this.props=props;}
  record User(UUID id,String username,String name,String hash,boolean active,int attempts,Instant lockedUntil){}
  @Transactional public Map<String,Object> login(String username,String pin){
    User user=db.sql("select id,username,display_name,pin_hash,active,failed_attempts,locked_until from app_user where lower(username)=lower(:u)").param("u",username.trim()).query(this::user).optional().orElseThrow(()->new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_CREDENTIALS","Invalid username or PIN"));
    if(!user.active()) throw new ApiException(HttpStatus.FORBIDDEN,"ACCOUNT_DISABLED","Account is disabled");
    if(user.lockedUntil()!=null&&user.lockedUntil().isAfter(Instant.now())) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"ACCOUNT_LOCKED","Account is temporarily locked");
    if(!encoder.matches(pin,user.hash())){
      int tries=user.attempts()+1; Instant until=tries>=5?Instant.now().plus(15,ChronoUnit.MINUTES):null;
      db.sql("update app_user set failed_attempts=:a,locked_until=:l,updated_at=now() where id=:id").param("a",tries).param("l",until==null?null:java.sql.Timestamp.from(until),java.sql.Types.TIMESTAMP_WITH_TIMEZONE).param("id",user.id()).update();
      throw new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_CREDENTIALS","Invalid username or PIN");
    }
    db.sql("update app_user set failed_attempts=0,locked_until=null,updated_at=now() where id=:id").param("id",user.id()).update();
    String refresh=randomToken(); String hash=hash(refresh);
    db.sql("insert into refresh_token(user_id,token_hash,expires_at) values(:u,:h,:e)").param("u",user.id()).param("h",hash).param("e",java.sql.Timestamp.from(Instant.now().plus(props.refreshDays(),ChronoUnit.DAYS))).update();
    audit(user.id(),null,"Login","User logged in");
    var result=new java.util.LinkedHashMap<String,Object>();result.put("accessToken",jwt.issue(user.id(),user.username()));result.put("refreshToken",refresh);result.put("user",profile(user.id()));return result;
  }
  @Transactional public Map<String,Object> refresh(String raw){
    var row=db.sql("select id,user_id from refresh_token where token_hash=:h and revoked_at is null and expires_at>now() for update").param("h",hash(raw)).query((rs,n)->Map.of("id",rs.getObject("id",UUID.class),"userId",rs.getObject("user_id",UUID.class))).optional().orElseThrow(()->new ApiException(HttpStatus.UNAUTHORIZED,"INVALID_REFRESH_TOKEN","Refresh token is invalid or expired"));
    UUID old=(UUID)row.get("id"), userId=(UUID)row.get("userId"); String next=randomToken(); UUID nextId=UUID.randomUUID();
    db.sql("insert into refresh_token(id,user_id,token_hash,expires_at) values(:id,:u,:h,:e)").param("id",nextId).param("u",userId).param("h",hash(next)).param("e",java.sql.Timestamp.from(Instant.now().plus(props.refreshDays(),ChronoUnit.DAYS))).update();
    db.sql("update refresh_token set revoked_at=now(),replaced_by=:n where id=:id").param("n",nextId).param("id",old).update();
    var p=profile(userId);var result=new java.util.LinkedHashMap<String,Object>();result.put("accessToken",jwt.issue(userId,(String)p.get("username")));result.put("refreshToken",next);result.put("user",p);return result;
  }
  @Transactional public void logout(String raw,UUID userId){if(raw!=null)db.sql("update refresh_token set revoked_at=now() where token_hash=:h and user_id=:u and revoked_at is null").param("h",hash(raw)).param("u",userId).update();audit(userId,null,"Logout","User logged out");}
  public Map<String,Object> profile(UUID id){
    var base=db.sql("select id,username,display_name from app_user where id=:id and active").param("id",id).query((rs,n)->new java.util.LinkedHashMap<String,Object>(Map.of("id",rs.getObject("id",UUID.class),"username",rs.getString("username"),"name",rs.getString("display_name")))).single();
    var memberships=db.sql("select m.business_id,b.name,m.role,m.masters,m.transactions,m.reports,m.audit,m.users,m.settings from membership m join business b on b.id=m.business_id where m.user_id=:id and m.active order by b.name").param("id",id).query((rs,n)->Map.of("businessId",rs.getObject("business_id",UUID.class),"businessName",rs.getString("name"),"role",rs.getString("role"),"permissions",Map.of("masters",rs.getBoolean("masters"),"transactions",rs.getBoolean("transactions"),"reports",rs.getBoolean("reports"),"audit",rs.getBoolean("audit"),"users",rs.getBoolean("users"),"settings",rs.getBoolean("settings")))).list();
    base.put("memberships",memberships); return base;
  }
  private User user(ResultSet rs,int n)throws java.sql.SQLException{return new User(rs.getObject("id",UUID.class),rs.getString("username"),rs.getString("display_name"),rs.getString("pin_hash"),rs.getBoolean("active"),rs.getInt("failed_attempts"),rs.getTimestamp("locked_until")==null?null:rs.getTimestamp("locked_until").toInstant());}
  private String randomToken(){byte[] b=new byte[48];random.nextBytes(b);return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(b);}
  private String hash(String v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(v.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
  private void audit(UUID actor,UUID business,String action,String details){
    if(business==null)db.sql("insert into audit_log(actor_id,action,details) values(:a,:x,:d)").param("a",actor).param("x",action).param("d",details).update();
    else db.sql("insert into audit_log(actor_id,business_id,action,details) values(:a,:b,:x,:d)").param("a",actor).param("b",business).param("x",action).param("d",details).update();
  }
}
