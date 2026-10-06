package com.mathan.erp.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mathan.erp.api.ApiErrorHandler;
import com.mathan.erp.config.MathanProperties;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AuthControllerTest {
  private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new AuthController(
      new AuthService(null, null, null,
          new MathanProperties("01234567890123456789012345678901", 15, 14, false,
              new MathanProperties.Bootstrap("admin", "1234"), List.of("http://localhost:3000"))),
      new MathanProperties("01234567890123456789012345678901", 15, 14, false,
          new MathanProperties.Bootstrap("admin", "1234"), List.of("http://localhost:3000"))))
    .setControllerAdvice(new ApiErrorHandler())
    .build();

  @Test
  void refreshWithoutCookieReturnsStableUnauthorizedResponse() throws Exception {
    mvc.perform(post("/api/v1/auth/refresh"))
      .andExpect(status().isUnauthorized())
      .andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));
  }
}
