package com.crimeevidence.backend.repository;

import com.crimeevidence.backend.model.EvidenceFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EvidenceFileRepository extends JpaRepository<EvidenceFile, Long> {
    List<EvidenceFile> findByCaseObjId(Long caseId);
}
