package com.mathan.erp.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class BootstrapAdmin implements ApplicationRunner {
  private final JdbcClient db; private final PasswordEncoder encoder; private final MathanProperties props;
  public BootstrapAdmin(JdbcClient db,PasswordEncoder encoder,MathanProperties props){this.db=db;this.encoder=encoder;this.props=props;}
  @Override @Transactional public void run(ApplicationArguments args){
    Integer count=db.sql("select count(*) from app_user").query(Integer.class).single(); if(count>0)return;
    db.sql("insert into app_user(username,display_name,pin_hash) values(:u,'System Administrator',:p)").param("u",props.bootstrap().username()).param("p",encoder.encode(props.bootstrap().pin())).update();
  }
}
