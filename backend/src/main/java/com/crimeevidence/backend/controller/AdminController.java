package com.crimeevidence.backend.controller;

import com.crimeevidence.backend.service.CaseService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin
public class AdminController {

    private final CaseService caseService;

    public AdminController(CaseService caseService) {
        this.caseService = caseService;
    }

    @GetMapping("/stations")
    public ResponseEntity<List<Map<String, Object>>> getStationSummary() {
        return ResponseEntity.ok(caseService.getStationSummary());
    }
}
