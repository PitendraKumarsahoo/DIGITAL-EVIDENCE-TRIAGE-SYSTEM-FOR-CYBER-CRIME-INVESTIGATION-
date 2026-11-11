package com.crimeevidence.backend.controller;

import com.crimeevidence.backend.config.JwtUtil;
import com.crimeevidence.backend.config.UserPrincipal;
import com.crimeevidence.backend.dto.AuthResponse;
import com.crimeevidence.backend.dto.LoginRequest;
import com.crimeevidence.backend.dto.RegisterRequest;
import com.crimeevidence.backend.model.User;
import com.crimeevidence.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(originPatterns = "*", allowCredentials = "true")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (request.getUsername() == null || request.getPassword() == null) {
            return ResponseEntity.badRequest().body(new AuthResponse(null, null, null, null, null, "Username and password are required"));
        }

        String username = request.getUsername().trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByUsername(username);
        User user;

        if (userOpt.isPresent()) {
            user = userOpt.get();
            if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new AuthResponse(null, null, null, null, null, "Invalid username or password"));
            }
        } else if (username.startsWith("investigator_")) {
            // Auto-provision investigator account for any of the 30 Odisha districts on-the-fly
            String rawDistrict = username.substring(13).trim();
            if (rawDistrict.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new AuthResponse(null, null, null, null, null, "Invalid username or password"));
            }

            String districtName = Arrays.stream(rawDistrict.split("_"))
                    .map(s -> s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase())
                    .reduce((a, b) -> a + " " + b)
                    .orElse(rawDistrict);

            user = new User(
                    username,
                    passwordEncoder.encode(request.getPassword()),
                    "Investigator - " + districtName,
                    "investigator",
                    districtName
            );
            userRepository.save(user);
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthResponse(null, null, null, null, null, "Invalid username or password"));
        }

        String token = jwtUtil.generateToken(user.getUsername(), user.getRole(), user.getDistrict(), user.getFullName());

        return ResponseEntity.ok(new AuthResponse(
                token,
                user.getUsername(),
                user.getFullName(),
                user.getRole(),
                user.getDistrict(),
                "Login successful"
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(new AuthResponse(null, null, null, null, null, "Logged out successfully"));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            if (!"admin".equalsIgnoreCase(principal.getRole())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new AuthResponse(null, null, null, null, null, "Only administrators can register new users"));
            }
        }

        if (request.getUsername() == null || request.getPassword() == null) {
            return ResponseEntity.badRequest().body(new AuthResponse(null, null, null, null, null, "Username and password are required"));
        }

        String username = request.getUsername().trim().toLowerCase();
        if (userRepository.existsByUsername(username)) {
            return ResponseEntity.badRequest().body(new AuthResponse(null, null, null, null, null, "Username already exists"));
        }

        String encodedPassword = passwordEncoder.encode(request.getPassword());
        String role = (request.getRole() != null && !request.getRole().isEmpty()) ? request.getRole() : "investigator";

        User newUser = new User(
                username,
                encodedPassword,
                request.getFullName(),
                role,
                request.getDistrict()
        );

        userRepository.save(newUser);

        return ResponseEntity.ok(new AuthResponse(
                null,
                newUser.getUsername(),
                newUser.getFullName(),
                newUser.getRole(),
                newUser.getDistrict(),
                "User registered successfully"
        ));
    }
}
