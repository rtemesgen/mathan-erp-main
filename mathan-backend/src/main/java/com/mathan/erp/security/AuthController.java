package com.mathan.erp.security;

import com.mathan.erp.config.MathanProperties;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthService auth; private final MathanProperties props;
  public AuthController(AuthService auth,MathanProperties props){this.auth=auth;this.props=props;}
  public record Login(@NotBlank String username,@Pattern(regexp="\\d{4,8}",message="PIN must contain 4 to 8 digits") String pin){}
  @PostMapping("/login") Map<String,Object> login(@Valid @RequestBody Login request,HttpServletResponse response){var result=auth.login(request.username(),request.pin());cookie(response,(String)result.remove("refreshToken"));return result;}
  @PostMapping("/refresh") Map<String,Object> refresh(@CookieValue(name="mathan_refresh") String token,HttpServletResponse response){var result=auth.refresh(token);cookie(response,(String)result.remove("refreshToken"));return result;}
  @PostMapping("/logout") void logout(@CookieValue(name="mathan_refresh",required=false)String token,@AuthenticationPrincipal UserPrincipal user,HttpServletResponse response){auth.logout(token,user.id());response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from("mathan_refresh","").httpOnly(true).secure(props.cookieSecure()).sameSite("Strict").path("/api/v1/auth").maxAge(0).build().toString());}
  @GetMapping("/me") Map<String,Object> me(@AuthenticationPrincipal UserPrincipal user){return auth.profile(user.id());}
  private void cookie(HttpServletResponse response,String value){response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from("mathan_refresh",value).httpOnly(true).secure(props.cookieSecure()).sameSite("Strict").path("/api/v1/auth").maxAge(Duration.ofDays(props.refreshDays())).build().toString());}
}

