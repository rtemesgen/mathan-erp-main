package com.mathan.erp.security;

import static org.assertj.core.api.Assertions.assertThat;
import com.mathan.erp.config.MathanProperties;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class JwtServiceTest {
  @Test void roundTripsAuthenticatedUser(){
    var service=new JwtService(new MathanProperties("01234567890123456789012345678901",15,14,false,new MathanProperties.Bootstrap("admin","1234"), java.util.List.of("http://localhost:*")));
    UUID id=UUID.randomUUID();
    assertThat(service.parse(service.issue(id,"admin"))).isEqualTo(new UserPrincipal(id,"admin"));
  }
}
