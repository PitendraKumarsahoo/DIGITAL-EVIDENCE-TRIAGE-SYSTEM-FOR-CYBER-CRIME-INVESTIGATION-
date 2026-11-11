package com.crimeevidence.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "keyword_search_results")
public class KeywordSearchResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "evidence_id", nullable = false)
    private Long evidenceId;

    @Column(nullable = false)
    private String keyword;

    private Boolean found;

    @Column(name = "search_date")
    private LocalDateTime searchDate;

    @Column(name = "occurrences_json", columnDefinition = "TEXT")
    private String occurrencesJson;

    public KeywordSearchResult() {}

    public KeywordSearchResult(Long evidenceId, String keyword, Boolean found, LocalDateTime searchDate, String occurrencesJson) {
        this.evidenceId = evidenceId;
        this.keyword = keyword;
        this.found = found;
        this.searchDate = searchDate;
        this.occurrencesJson = occurrencesJson;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getEvidenceId() {
        return evidenceId;
    }

    public void setEvidenceId(Long evidenceId) {
        this.evidenceId = evidenceId;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public Boolean getFound() {
        return found;
    }

    public void setFound(Boolean found) {
        this.found = found;
    }

    public LocalDateTime getSearchDate() {
        return searchDate;
    }

    public void setSearchDate(LocalDateTime searchDate) {
        this.searchDate = searchDate;
    }

    public String getOccurrencesJson() {
        return occurrencesJson;
    }

    public void setOccurrencesJson(String occurrencesJson) {
        this.occurrencesJson = occurrencesJson;
    }
}
