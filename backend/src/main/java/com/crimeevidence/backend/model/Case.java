package com.crimeevidence.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cases")
public class Case {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String status;

    private String station;

    private String district;

    @Column(name = "created_date")
    private LocalDateTime createdDate;

    @Column(name = "ai_report", columnDefinition = "TEXT")
    private String aiReport;

    public Case() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getStation() {
        return station != null ? station : district;
    }

    public void setStation(String station) {
        this.station = station;
        if (this.district == null) {
            this.district = station;
        }
    }

    public String getDistrict() {
        return district != null ? district : station;
    }

    public void setDistrict(String district) {
        this.district = district;
        if (this.station == null) {
            this.station = district;
        }
    }

    public LocalDateTime getCreatedDate() {
        return createdDate;
    }

    public void setCreatedDate(LocalDateTime createdDate) {
        this.createdDate = createdDate;
    }

    public String getAiReport() {
        return aiReport;
    }

    public void setAiReport(String aiReport) {
        this.aiReport = aiReport;
    }
}
