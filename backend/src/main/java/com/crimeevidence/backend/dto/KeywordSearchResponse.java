package com.crimeevidence.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

public class KeywordSearchResponse {
    private String keyword;
    private boolean found;
    private List<Occurrence> occurrences;

    public KeywordSearchResponse() {}

    public KeywordSearchResponse(String keyword, boolean found, List<Occurrence> occurrences) {
        this.keyword = keyword;
        this.found = found;
        this.occurrences = occurrences;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public boolean isFound() {
        return found;
    }

    public void setFound(boolean found) {
        this.found = found;
    }

    public List<Occurrence> getOccurrences() {
        return occurrences;
    }

    public void setOccurrences(List<Occurrence> occurrences) {
        this.occurrences = occurrences;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Occurrence {
        private Integer page;
        private String snippet;

        public Occurrence() {}

        public Occurrence(Integer page, String snippet) {
            this.page = page;
            this.snippet = snippet;
        }

        public Integer getPage() {
            return page;
        }

        public void setPage(Integer page) {
            this.page = page;
        }

        public String getSnippet() {
            return snippet;
        }

        public void setSnippet(String snippet) {
            this.snippet = snippet;
        }
    }
}
