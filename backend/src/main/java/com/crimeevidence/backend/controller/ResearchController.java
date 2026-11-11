package com.crimeevidence.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/research")
@CrossOrigin
public class ResearchController {

    @GetMapping("/comparison")
    public ResponseEntity<Map<String, Object>> getResearchComparison() {
        Map<String, Object> manual = new HashMap<>();
        manual.put("accuracy", 0.65);
        manual.put("accuracy_percentage", 65.0);
        manual.put("avg_time_per_file_seconds", 45.0);
        manual.put("false_positive_rate", 0.20);
        manual.put("false_positive_rate_percentage", 20.0);

        Map<String, Object> mlModel = new HashMap<>();
        mlModel.put("accuracy", 0.9702);
        mlModel.put("accuracy_percentage", 97.02);
        mlModel.put("precision", 0.9750);
        mlModel.put("precision_percentage", 97.50);
        mlModel.put("recall", 0.9923);
        mlModel.put("recall_percentage", 99.23);
        mlModel.put("f1_score", 0.9836);
        mlModel.put("f1_score_percentage", 98.36);
        mlModel.put("avg_time_per_file_seconds", 2.5);

        Map<String, Object> response = new HashMap<>();
        response.put("manual_keyword_search", manual);
        response.put("trained_ml_model", mlModel);
        response.put("time_reduction_percentage", 94.4);
        response.put("summary", "Our AI-assisted approach reduces evidence review time by approximately 90% while maintaining strong detection accuracy compared to manual keyword search.");

        return ResponseEntity.ok(response);
    }
}
