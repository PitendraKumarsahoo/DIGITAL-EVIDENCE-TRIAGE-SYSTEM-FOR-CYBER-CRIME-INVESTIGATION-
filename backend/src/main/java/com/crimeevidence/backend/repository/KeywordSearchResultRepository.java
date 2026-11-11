package com.crimeevidence.backend.repository;

import com.crimeevidence.backend.model.KeywordSearchResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface KeywordSearchResultRepository extends JpaRepository<KeywordSearchResult, Long> {
    List<KeywordSearchResult> findByEvidenceId(Long evidenceId);
}
