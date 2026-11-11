package com.crimeevidence.backend.dto;

public class AuthResponse {
    private String token;
    private String username;
    private String fullName;
    private String role;
    private String district;
    private String message;

    public AuthResponse() {}

    public AuthResponse(String token, String username, String fullName, String role, String district, String message) {
        this.token = token;
        this.username = username;
        this.fullName = fullName;
        this.role = role;
        this.district = district;
        this.message = message;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getDistrict() {
        return district;
    }

    public void setDistrict(String district) {
        this.district = district;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
