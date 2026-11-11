package com.crimeevidence.backend.config;

import com.crimeevidence.backend.model.Case;
import com.crimeevidence.backend.model.User;
import com.crimeevidence.backend.repository.CaseRepository;
import com.crimeevidence.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CaseRepository caseRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        createOrUpdateUser("admin", "Demo@123", "System Administrator", "admin", null);
        createOrUpdateUser("investigator_khordha", "Demo@123", "Investigator - Khordha", "investigator", "Khordha");
        createOrUpdateUser("investigator_cuttack", "Demo@123", "Investigator - Cuttack", "investigator", "Cuttack");
        createOrUpdateUser("investigator_ganjam", "Demo@123", "Investigator - Ganjam", "investigator", "Ganjam");
        createOrUpdateUser("investigator", "Demo@123", "Inspector Das", "investigator", "Khordha");

        // Assign sample districts to cases if not set or all set to same
        List<Case> cases = caseRepository.findAll();
        if (!cases.isEmpty()) {
            String[] sampleDistricts = {"Khordha", "Cuttack", "Ganjam", "Sambalpur", "Khordha", "Cuttack", "Ganjam", "Khordha"};
            for (int i = 0; i < cases.size(); i++) {
                Case c = cases.get(i);
                if (c.getDistrict() == null || c.getDistrict().isEmpty() || c.getDistrict().equalsIgnoreCase("Bhubaneswar Cyber Cell")) {
                    c.setDistrict(sampleDistricts[i % sampleDistricts.length]);
                    c.setStation(sampleDistricts[i % sampleDistricts.length] + " Cyber Cell");
                    caseRepository.save(c);
                }
            }
        }

        System.out.println("District demo users initialized successfully!");
    }

    private void createOrUpdateUser(String username, String rawPassword, String fullName, String role, String district) {
        userRepository.findByUsername(username).ifPresentOrElse(
            user -> {
                user.setPassword(passwordEncoder.encode(rawPassword));
                user.setFullName(fullName);
                user.setRole(role);
                user.setDistrict(district);
                userRepository.save(user);
            },
            () -> {
                User newUser = new User(
                    username,
                    passwordEncoder.encode(rawPassword),
                    fullName,
                    role,
                    district
                );
                userRepository.save(newUser);
            }
        );
    }
}
