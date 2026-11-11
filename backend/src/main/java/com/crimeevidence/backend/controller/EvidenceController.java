package com.crimeevidence.backend.controller;

import com.crimeevidence.backend.dto.KeywordSearchRequest;
import com.crimeevidence.backend.dto.KeywordSearchResponse;
import com.crimeevidence.backend.dto.TextEvidenceRequest;
import com.crimeevidence.backend.model.EvidenceFile;
import com.crimeevidence.backend.service.EvidenceFileService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

@RestController
@RequestMapping("/api/evidence")
@CrossOrigin(originPatterns = "*", allowCredentials = "true")
public class EvidenceController {

    private final EvidenceFileService evidenceFileService;

    public EvidenceController(EvidenceFileService evidenceFileService) {
        this.evidenceFileService = evidenceFileService;
    }

    @PostMapping("/upload")
    public ResponseEntity<EvidenceFile> uploadEvidence(
            @RequestParam("caseId") Long caseId,
            @RequestParam("file") MultipartFile file) {
        EvidenceFile uploaded = evidenceFileService.uploadEvidence(caseId, file);
        return ResponseEntity.ok(uploaded);
    }

    @PostMapping("/upload-text")
    public ResponseEntity<EvidenceFile> uploadTextEvidence(@RequestBody TextEvidenceRequest request) {
        if (request.getCaseId() == null || request.getTextContent() == null) {
            return ResponseEntity.badRequest().build();
        }
        EvidenceFile uploaded = evidenceFileService.uploadTextEvidence(request.getCaseId(), request.getTextContent());
        return ResponseEntity.ok(uploaded);
    }

    @PostMapping("/{evidenceId}/search-keyword")
    public ResponseEntity<KeywordSearchResponse> searchKeyword(
            @PathVariable Long evidenceId,
            @RequestBody KeywordSearchRequest request) {
        if (request.getKeyword() == null || request.getKeyword().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        KeywordSearchResponse response = evidenceFileService.searchKeyword(evidenceId, request.getKeyword());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/upload-audio")
    public ResponseEntity<EvidenceFile> uploadAudioEvidence(
            @RequestParam("caseId") Long caseId,
            @RequestParam("audio") MultipartFile audioFile) {
        if (audioFile == null || audioFile.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        EvidenceFile uploaded = evidenceFileService.uploadAudioEvidence(caseId, audioFile);
        return ResponseEntity.ok(uploaded);
    }

    @PostMapping("/{evidenceId}/retry-analysis")
    public ResponseEntity<EvidenceFile> retryAnalysis(@PathVariable Long evidenceId) {
        EvidenceFile result = evidenceFileService.retryAnalysis(evidenceId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/case/{caseId}")
    public ResponseEntity<List<EvidenceFile>> getEvidenceByCaseId(@PathVariable Long caseId) {
        return ResponseEntity.ok(evidenceFileService.getEvidenceByCaseId(caseId));
    }
}
