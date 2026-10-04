package com.mathan.erp.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import java.util.List;

@ConfigurationProperties(prefix="mathan")
public record MathanProperties(String jwtSecret, int accessMinutes, int refreshDays, boolean cookieSecure, Bootstrap bootstrap, List<String> allowedOrigins) {
  public record Bootstrap(String username, String pin) {}
}
