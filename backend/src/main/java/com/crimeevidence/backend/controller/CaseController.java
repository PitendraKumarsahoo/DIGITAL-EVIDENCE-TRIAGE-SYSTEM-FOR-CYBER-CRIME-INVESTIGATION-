package com.crimeevidence.backend.controller;

import com.crimeevidence.backend.config.UserPrincipal;
import com.crimeevidence.backend.model.Case;
import com.crimeevidence.backend.service.CaseService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cases")
@CrossOrigin(originPatterns = "*", allowCredentials = "true")
public class CaseController {

    private final CaseService caseService;

    public CaseController(CaseService caseService) {
        this.caseService = caseService;
    }

    @PostMapping
    public ResponseEntity<Case> createCase(@RequestBody Case caseObj) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            if ((caseObj.getDistrict() == null || caseObj.getDistrict().isEmpty()) && principal.getDistrict() != null) {
                caseObj.setDistrict(principal.getDistrict());
            }
        }
        Case created = caseService.createCase(caseObj);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    public ResponseEntity<List<Case>> getAllCases() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            if ("investigator".equalsIgnoreCase(principal.getRole()) && principal.getDistrict() != null) {
                return ResponseEntity.ok(caseService.getCasesByDistrict(principal.getDistrict()));
            }
        }
        return ResponseEntity.ok(caseService.getAllCases());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Case> getCaseById(@PathVariable Long id) {
        return ResponseEntity.ok(caseService.getCaseById(id));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Case> updateCaseStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null) {
            return ResponseEntity.badRequest().build();
        }
        Case updated = caseService.updateCaseStatus(id, status);
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/{caseId}/timeline")
    public ResponseEntity<List<Map<String, Object>>> getCaseTimeline(@PathVariable Long caseId) {
        return ResponseEntity.ok(caseService.getCaseTimeline(caseId));
    }

    @PostMapping("/{caseId}/generate-report")
    public ResponseEntity<String> generateReport(@PathVariable Long caseId) {
        return ResponseEntity.ok(caseService.generateCaseReport(caseId));
    }

    @GetMapping("/{caseId}/report")
    public ResponseEntity<String> getSavedReport(@PathVariable Long caseId) {
        Case c = caseService.getCaseById(caseId);
        return ResponseEntity.ok(c.getAiReport());
    }

    @GetMapping("/{caseId}/export-pdf")
    public ResponseEntity<byte[]> exportCasePdf(@PathVariable Long caseId) {
        try {
            byte[] pdfBytes = caseService.generateCasePdfReport(caseId);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", "Case_" + caseId + "_Report.pdf");
            headers.setContentLength(pdfBytes.length);
            return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
        } catch (Exception e) {
            System.err.println("PDF export failed for case " + caseId + ": " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
