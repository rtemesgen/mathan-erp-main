package com.mathan.erp.security;

import com.mathan.erp.config.MathanProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
  private final MathanProperties props;
  private final SecretKey key;
  public JwtService(MathanProperties props) {
    this.props=props;
    byte[] bytes=props.jwtSecret().getBytes(StandardCharsets.UTF_8);
    if(bytes.length<32) throw new IllegalStateException("MATHAN_JWT_SECRET must be at least 32 bytes");
    this.key=Keys.hmacShaKeyFor(bytes);
  }
  public String issue(UUID id,String username) {
    Instant now=Instant.now();
    return Jwts.builder().subject(id.toString()).claim("username",username).issuedAt(Date.from(now))
      .expiration(Date.from(now.plusSeconds(props.accessMinutes()*60L))).signWith(key).compact();
  }
  public UserPrincipal parse(String token) {
    var claims=Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    return new UserPrincipal(UUID.fromString(claims.getSubject()),claims.get("username",String.class));
  }
}

