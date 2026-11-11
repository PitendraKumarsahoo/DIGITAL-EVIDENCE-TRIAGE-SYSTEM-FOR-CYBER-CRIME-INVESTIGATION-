package com.crimeevidence.backend.repository;

import com.crimeevidence.backend.model.Case;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CaseRepository extends JpaRepository<Case, Long> {
    @Query("SELECT c FROM Case c WHERE LOWER(c.district) = LOWER(:district) OR LOWER(c.station) = LOWER(:district)")
    List<Case> findByDistrictOrStation(@Param("district") String district);
}
