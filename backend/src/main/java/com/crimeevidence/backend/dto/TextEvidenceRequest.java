package com.crimeevidence.backend.dto;

public class TextEvidenceRequest {
    private Long caseId;
    private String textContent;

    public TextEvidenceRequest() {}

    public Long getCaseId() {
        return caseId;
    }

    public void setCaseId(Long caseId) {
        this.caseId = caseId;
    }

    public String getTextContent() {
        return textContent;
    }

    public void setTextContent(String textContent) {
        this.textContent = textContent;
    }
}
