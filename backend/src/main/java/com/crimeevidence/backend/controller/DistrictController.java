package com.crimeevidence.backend.controller;

import org.springframework.web.bind.annotation.*;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/districts")
@CrossOrigin(originPatterns = "*", allowCredentials = "true")
public class DistrictController {

    private static final List<String> ODISHA_DISTRICTS = Arrays.asList(
        "Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh",
        "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur",
        "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar",
        "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh",
        "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"
    );

    @GetMapping
    public List<String> getDistricts() {
        return ODISHA_DISTRICTS;
    }
}
