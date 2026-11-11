package com.crimeevidence.backend.service;

import com.crimeevidence.backend.exception.ResourceNotFoundException;

import com.crimeevidence.backend.model.Case;
import com.crimeevidence.backend.model.EvidenceFile;
import com.crimeevidence.backend.repository.CaseRepository;
import com.crimeevidence.backend.repository.EvidenceFileRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import jakarta.annotation.PostConstruct;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

// iText7 PDF generation imports
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.element.LineSeparator;
import com.itextpdf.kernel.pdf.canvas.draw.SolidLine;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.io.font.constants.StandardFonts;

@Service
public class CaseService {

    private final CaseRepository caseRepository;
    private final EvidenceFileRepository evidenceFileRepository;
    private final RestTemplate restTemplate;
    private final DataSource dataSource;

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    public CaseService(CaseRepository caseRepository, EvidenceFileRepository evidenceFileRepository, RestTemplate restTemplate, DataSource dataSource) {
        this.caseRepository = caseRepository;
        this.evidenceFileRepository = evidenceFileRepository;
        this.restTemplate = restTemplate;
        this.dataSource = dataSource;
    }

    @PostConstruct
    public void migrateSchema() {
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("ALTER TABLE cases MODIFY COLUMN description TEXT");
            System.out.println("Schema migration: Modified description column to TEXT successfully.");
        } catch (Exception e) {
            System.err.println("Schema migration warning (description modify): " + e.getMessage());
        }

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("ALTER TABLE cases ADD COLUMN station VARCHAR(255) DEFAULT 'Bhubaneswar Cyber Cell'");
            System.out.println("Schema migration: Added station column to cases table successfully.");
        } catch (Exception e) {
            // Column may already exist
            System.out.println("Schema migration info (station column): " + e.getMessage());
        }
    }

    public Case createCase(Case newCase) {
        if (newCase.getCreatedDate() == null) {
            newCase.setCreatedDate(LocalDateTime.now());
        }
        if (newCase.getStation() == null || newCase.getStation().trim().isEmpty()) {
            newCase.setStation("Bhubaneswar Cyber Cell");
        }
        return caseRepository.save(newCase);
    }

    public List<Map<String, Object>> getStationSummary() {
        List<Case> allCases = caseRepository.findAll();

        List<String> defaultStations = List.of(
            "Bhubaneswar Cyber Cell",
            "Cuttack Cyber Cell",
            "Rourkela Cyber Cell",
            "Berhampur Cyber Cell",
            "Sambalpur Cyber Cell"
        );

        Map<String, Map<String, Integer>> stationCounts = new java.util.LinkedHashMap<>();

        for (String st : defaultStations) {
            Map<String, Integer> counts = new HashMap<>();
            counts.put("total", 0);
            counts.put("open", 0);
            stationCounts.put(st, counts);
        }

        for (Case c : allCases) {
            String st = c.getStation();
            if (st == null || st.trim().isEmpty()) {
                st = "Bhubaneswar Cyber Cell";
            }
            st = st.trim();

            if (!stationCounts.containsKey(st)) {
                Map<String, Integer> counts = new HashMap<>();
                counts.put("total", 0);
                counts.put("open", 0);
                stationCounts.put(st, counts);
            }

            Map<String, Integer> counts = stationCounts.get(st);
            counts.put("total", counts.get("total") + 1);

            if ("open".equalsIgnoreCase(c.getStatus())) {
                counts.put("open", counts.get("open") + 1);
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, Map<String, Integer>> entry : stationCounts.entrySet()) {
            Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("station", entry.getKey());
            item.put("totalCases", entry.getValue().get("total"));
            item.put("openCases", entry.getValue().get("open"));
            result.add(item);
        }

        return result;
    }

    public List<Case> getAllCases() {
        return caseRepository.findAll();
    }

    public List<Case> getCasesByDistrict(String district) {
        if (district == null || district.trim().isEmpty() || "all".equalsIgnoreCase(district.trim())) {
            return caseRepository.findAll();
        }
        return caseRepository.findByDistrictOrStation(district.trim());
    }

    public Case getCaseById(Long id) {
        return caseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Case not found with id: " + id));
    }

    public Case updateCaseStatus(Long id, String status) {
        Case existingCase = getCaseById(id);
        existingCase.setStatus(status);
        return caseRepository.save(existingCase);
    }

    public List<Map<String, Object>> getCaseTimeline(Long caseId) {
        Case c = getCaseById(caseId);
        List<EvidenceFile> evidenceFiles = evidenceFileRepository.findByCaseObjId(caseId);

        List<Map<String, Object>> timeline = new ArrayList<>();

        // 1. Case created event
        Map<String, Object> creationEvent = new HashMap<>();
        creationEvent.put("event", "Case created");
        creationEvent.put("date", c.getCreatedDate());
        creationEvent.put("details", "Case \"" + c.getTitle() + "\" initialized in repository.");
        timeline.add(creationEvent);

        // 2. Evidence uploaded & flagged events
        for (EvidenceFile file : evidenceFiles) {
            LocalDateTime uploadDate = file.getUploadDate();
            
            // Upload Event
            Map<String, Object> uploadEvent = new HashMap<>();
            uploadEvent.put("event", "Evidence uploaded: " + file.getFilename());
            uploadEvent.put("date", uploadDate);
            uploadEvent.put("details", "File format: " + file.getFileType() + ", status: " + file.getStatus());
            timeline.add(uploadEvent);

            // Suspicious Flagged Event
            if (Boolean.TRUE.equals(file.getIsSuspicious())) {
                Map<String, Object> suspectEvent = new HashMap<>();
                suspectEvent.put("event", "Suspicious content flagged: " + file.getFilename());
                suspectEvent.put("date", uploadDate);
                suspectEvent.put("details", "Flagged keywords: " + file.getFlaggedKeywords() + " (Confidence: " + (file.getConfidenceScore() != null ? (int)(file.getConfidenceScore() * 100) : 0) + "%)");
                timeline.add(suspectEvent);
            }
        }

        // Sort all events by date/time ascending
        timeline.sort((e1, e2) -> {
            LocalDateTime d1 = (LocalDateTime) e1.get("date");
            LocalDateTime d2 = (LocalDateTime) e2.get("date");
            if (d1 == null && d2 == null) return 0;
            if (d1 == null) return -1;
            if (d2 == null) return 1;
            return d1.compareTo(d2);
        });

        return timeline;
    }

    public String generateCaseReport(Long caseId) {
        Case c = getCaseById(caseId);
        List<EvidenceFile> evidenceFiles = evidenceFileRepository.findByCaseObjId(caseId);

        // Try Gemini API if key is available
        if (geminiApiKey != null && !geminiApiKey.trim().isEmpty()) {
            StringBuilder promptBuilder = new StringBuilder();
            promptBuilder.append("You are a professional cybercrime investigator writing a Case Summary Report.\n");
            
            if (evidenceFiles.size() <= 3) {
                promptBuilder.append("Write a SHORT summary: 3-6 sentences total. Reference the specific evidence filenames, specific flagged keywords, and specific confidence scores from the data below. Do not use generic forensic report templates or boilerplate language.\n\n");
            } else {
                promptBuilder.append("Write a summary of 2 short paragraphs. Reference specific evidence filenames, specific flagged keywords, and specific confidence scores from the data below. Do not invent details.\n\n");
            }

            promptBuilder.append("CRITICAL INSTRUCTIONS:\n");
            promptBuilder.append("- Reference specific filenames (e.g. \"evidence_chat.png\"), specific flagged keywords (e.g. \"hack\", \"fraud\"), and specific confidence scores (e.g. \"87% confidence\") directly.\n");
            promptBuilder.append("- Do NOT use generic phrases like 'digital forensic evidence', 'comprehensive analysis', or 'further investigation is warranted' — be specific.\n");
            promptBuilder.append("- Write in plain, professional paragraphs using markdown bold for key terms.\n");
            promptBuilder.append("- Do not invent details not present in the evidence data provided below.\n\n");

            promptBuilder.append("CASE DETAILS:\n");
            promptBuilder.append("- Case ID: ").append(c.getId()).append("\n");
            promptBuilder.append("- Title: ").append(c.getTitle()).append("\n");
            promptBuilder.append("- Description: ").append(c.getDescription() != null ? c.getDescription() : "None").append("\n");
            promptBuilder.append("- Current Status: ").append(c.getStatus()).append("\n");
            if (c.getDistrict() != null && !c.getDistrict().isEmpty()) {
                promptBuilder.append("- District: ").append(c.getDistrict()).append("\n");
            }
            if (c.getStation() != null && !c.getStation().isEmpty()) {
                promptBuilder.append("- Reporting Station: ").append(c.getStation()).append("\n");
            }
            promptBuilder.append("\n");

            promptBuilder.append("EVIDENCE PAYLOADS:\n");

            if (evidenceFiles.isEmpty()) {
                promptBuilder.append("[No evidence files uploaded for this case yet.]\n");
            } else {
                for (EvidenceFile file : evidenceFiles) {
                    promptBuilder.append("- Filename: ").append(file.getFilename()).append("\n");
                    promptBuilder.append("  File Type: ").append(file.getFileType()).append("\n");
                    promptBuilder.append("  Is Duplicate: ").append(Boolean.TRUE.equals(file.getIsDuplicate())).append("\n");
                    promptBuilder.append("  Is Suspicious (AI flagged): ").append(Boolean.TRUE.equals(file.getIsSuspicious())).append("\n");
                    if (file.getFlaggedKeywords() != null && !file.getFlaggedKeywords().isEmpty()) {
                        promptBuilder.append("  Flagged Keywords: ").append(file.getFlaggedKeywords()).append("\n");
                    }
                    if (file.getExtractedText() != null && !file.getExtractedText().isEmpty()) {
                        String text = file.getExtractedText();
                        if (text.length() > 500) {
                            text = text.substring(0, 500) + "... [truncated]";
                        }
                        promptBuilder.append("  Extracted Content: ").append(text).append("\n");
                    }
                    promptBuilder.append("\n");
                }
            }

            String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;

            Map<String, Object> part = new HashMap<>();
            part.put("text", promptBuilder.toString());

            Map<String, Object> contentMap = new HashMap<>();
            contentMap.put("parts", List.of(part));

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("contents", List.of(contentMap));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);

            try {
                ResponseEntity<Map> response = restTemplate.postForEntity(url, requestEntity, Map.class);
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    Map<String, Object> body = response.getBody();
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
                    if (candidates != null && !candidates.isEmpty()) {
                        Map<String, Object> candidate = candidates.get(0);
                        @SuppressWarnings("unchecked")
                        Map<String, Object> responseContent = (Map<String, Object>) candidate.get("content");
                        if (responseContent != null) {
                            @SuppressWarnings("unchecked")
                            List<Map<String, Object>> parts = (List<Map<String, Object>>) responseContent.get("parts");
                            if (parts != null && !parts.isEmpty()) {
                                String aiReport = (String) parts.get(0).get("text");
                                if (aiReport != null && !aiReport.trim().isEmpty()) {
                                    c.setAiReport(aiReport);
                                    caseRepository.save(c);
                                    return aiReport;
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                System.err.println("Gemini API call failed, using forensic report generator fallback: " + e.getMessage());
            }
        }

        // Fallback Intelligent Report Generator
        String fallbackReport = generateFallbackReport(c, evidenceFiles);
        c.setAiReport(fallbackReport);
        caseRepository.save(c);
        return fallbackReport;
    }

    private String generateFallbackReport(Case c, List<EvidenceFile> evidenceFiles) {
        StringBuilder sb = new StringBuilder();
        sb.append("**CASE INVESTIGATION REPORT: CASE #").append(c.getId()).append("**\n\n");
        sb.append("**Case Title:** ").append(c.getTitle()).append("  \n");
        sb.append("**Status:** ").append(c.getStatus() != null ? c.getStatus() : "Open").append("  \n");
        sb.append("**Report Date:** ").append(LocalDateTime.now().toString()).append("\n\n");
        sb.append("---\n\n");

        sb.append("### Incident Summary\n");
        if (c.getDescription() != null && !c.getDescription().trim().isEmpty()) {
            sb.append(c.getDescription().trim()).append("\n\n");
        } else {
            sb.append("This forensic investigation report details digital evidence collected for Case #")
              .append(c.getId()).append(" (\"").append(c.getTitle()).append("\").\n\n");
        }

        sb.append("### Evidence Forensic Analysis\n");
        if (evidenceFiles.isEmpty()) {
            sb.append("No digital evidence files have been cataloged for this case yet. Forensic triage is pending evidence ingestion.\n\n");
        } else {
            long suspiciousCount = evidenceFiles.stream().filter(f -> Boolean.TRUE.equals(f.getIsSuspicious())).count();
            long duplicateCount = evidenceFiles.stream().filter(f -> Boolean.TRUE.equals(f.getIsDuplicate())).count();

            sb.append("A total of ").append(evidenceFiles.size()).append(" artifact(s) were submitted and analyzed. ");
            if (suspiciousCount > 0) {
                sb.append("Automated OCR screening flagged ").append(suspiciousCount).append(" high-risk item(s). ");
            } else {
                sb.append("Automated screening identified no immediate keyword indicators of compromise. ");
            }
            if (duplicateCount > 0) {
                sb.append("(").append(duplicateCount).append(" duplicate file(s) identified).");
            }
            sb.append("\n\n");

            for (EvidenceFile file : evidenceFiles) {
                sb.append("**Artifact:** `").append(file.getFilename()).append("`\n");
                sb.append("- **File Type:** ").append(file.getFileType() != null ? file.getFileType() : "Unknown").append("\n");
                sb.append("- **Duplicate:** ").append(Boolean.TRUE.equals(file.getIsDuplicate()) ? "Yes" : "No").append("\n");
                if (Boolean.TRUE.equals(file.getIsSuspicious())) {
                    sb.append("- **Status:** **[FLAGGED SUSPICIOUS]**\n");
                    if (file.getConfidenceScore() != null) {
                        sb.append("- **Risk Score:** ").append(String.format("%.0f%%", file.getConfidenceScore() * 100)).append("\n");
                    }
                    if (file.getFlaggedKeywords() != null && !file.getFlaggedKeywords().isEmpty()) {
                        sb.append("- **Flagged Keywords:** `").append(file.getFlaggedKeywords()).append("`\n");
                    }
                } else {
                    sb.append("- **Status:** Clean / Normal\n");
                }

                if (file.getExtractedText() != null && !file.getExtractedText().trim().isEmpty()) {
                    String text = file.getExtractedText().trim();
                    if (text.length() > 400) {
                        text = text.substring(0, 400) + "... [truncated]";
                    }
                    sb.append("- **Extracted OCR Text:** \"").append(text).append("\"\n");
                }
                sb.append("\n");
            }
        }

        sb.append("### Investigative Conclusion & Next Steps\n");
        boolean hasSuspicious = evidenceFiles.stream().anyMatch(f -> Boolean.TRUE.equals(f.getIsSuspicious()));
        if (hasSuspicious) {
            sb.append("Due to suspicious text extractions and security keyword matches, immediate manual review of affected endpoints and network activity is recommended.\n");
        } else if (evidenceFiles.isEmpty()) {
            sb.append("Awaiting digital artifact submission for initial evidence ingestion.\n");
        } else {
            sb.append("All cataloged evidence artifacts appear clean upon automated OCR screening. Routine case archive recommended unless additional evidence is submitted.\n");
        }

        return sb.toString();
    }

    /**
     * Feature 3.1: Generate a PDF case report as a byte array for download.
     */
    public byte[] generateCasePdfReport(Long caseId) throws IOException {
        Case c = getCaseById(caseId);
        List<EvidenceFile> evidenceFiles = evidenceFileRepository.findByCaseObjId(caseId);
        List<Map<String, Object>> timeline = getCaseTimeline(caseId);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");
        String exportTime = LocalDateTime.now().format(fmt);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter pdfWriter = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(pdfWriter);
        Document document = new Document(pdf);

        PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
        PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
        PdfFont mono = PdfFontFactory.createFont(StandardFonts.COURIER);

        DeviceRgb headerColor = new DeviceRgb(15, 23, 42);
        DeviceRgb accentColor = new DeviceRgb(37, 99, 235);
        DeviceRgb dangerColor = new DeviceRgb(220, 38, 38);
        DeviceRgb successColor = new DeviceRgb(22, 163, 74);
        DeviceRgb mutedColor = new DeviceRgb(100, 116, 139);

        // Header
        document.add(new Paragraph("CrimeEvidence AI")
                .setFont(bold).setFontSize(22).setFontColor(accentColor)
                .setTextAlignment(TextAlignment.CENTER));
        document.add(new Paragraph("CYBERCRIME EVIDENCE MANAGEMENT SYSTEM — CASE REPORT")
                .setFont(regular).setFontSize(9).setFontColor(mutedColor)
                .setTextAlignment(TextAlignment.CENTER).setMarginBottom(5));
        document.add(new LineSeparator(new SolidLine(1f)));

        // Case Details
        document.add(new Paragraph("CASE SUMMARY").setFont(bold).setFontSize(13)
                .setFontColor(headerColor).setMarginTop(14).setMarginBottom(5));
        Table caseTable = new Table(UnitValue.createPercentArray(new float[]{35, 65})).useAllAvailableWidth();
        addRow(caseTable, "Case ID", "#" + c.getId(), bold, regular, mutedColor);
        addRow(caseTable, "Title", c.getTitle(), bold, bold, mutedColor);
        addRow(caseTable, "Status", c.getStatus() != null ? c.getStatus().toUpperCase() : "Unknown", bold, regular, mutedColor);
        String station = c.getStation() != null ? c.getStation() : (c.getDistrict() != null ? c.getDistrict() : "N/A");
        addRow(caseTable, "District / Station", station, bold, regular, mutedColor);
        addRow(caseTable, "Created Date", c.getCreatedDate() != null ? c.getCreatedDate().format(fmt) : "N/A", bold, regular, mutedColor);
        if (c.getDescription() != null && !c.getDescription().trim().isEmpty()) {
            addRow(caseTable, "Description", c.getDescription(), bold, regular, mutedColor);
        }
        document.add(caseTable);

        // Evidence Files
        document.add(new LineSeparator(new SolidLine(0.5f)).setMarginTop(12));
        document.add(new Paragraph("EVIDENCE FILES (" + evidenceFiles.size() + " total)")
                .setFont(bold).setFontSize(13).setFontColor(headerColor).setMarginTop(12).setMarginBottom(5));

        if (evidenceFiles.isEmpty()) {
            document.add(new Paragraph("No evidence files have been uploaded for this case.")
                    .setFont(regular).setFontSize(10).setFontColor(mutedColor));
        } else {
            for (int i = 0; i < evidenceFiles.size(); i++) {
                EvidenceFile f = evidenceFiles.get(i);
                boolean susp = Boolean.TRUE.equals(f.getIsSuspicious());
                document.add(new Paragraph("Evidence #" + (i + 1) + ": " + f.getFilename())
                        .setFont(bold).setFontSize(10).setMarginTop(6).setMarginBottom(2)
                        .setFontColor(susp ? dangerColor : headerColor));

                Table evTable = new Table(UnitValue.createPercentArray(new float[]{35, 65})).useAllAvailableWidth();
                addRow(evTable, "File Type", f.getFileType() != null ? f.getFileType() : "Unknown", bold, mono, mutedColor);
                addRow(evTable, "Upload Date", f.getUploadDate() != null ? f.getUploadDate().format(fmt) : "N/A", bold, regular, mutedColor);
                String aiStatus = susp ? "SUSPICIOUS" : ("COMPLETED".equals(f.getStatus()) ? "CLEAN" : (f.getStatus() != null ? f.getStatus() : "UNKNOWN"));
                addRow(evTable, "AI Analysis", aiStatus, bold, bold, mutedColor);
                if (f.getConfidenceScore() != null) {
                    addRow(evTable, "Confidence", String.format("%.1f%%", f.getConfidenceScore() * 100), bold, regular, mutedColor);
                }
                if (f.getFlaggedKeywords() != null && !f.getFlaggedKeywords().trim().isEmpty()) {
                    addRow(evTable, "Flagged Keywords", f.getFlaggedKeywords(), bold, regular, mutedColor);
                }
                if (Boolean.TRUE.equals(f.getIsDuplicate())) {
                    String dupMsg = "Duplicate detected (matches Evidence ID #" + f.getDuplicateOfId() + ")";
                    if (f.getSimilarityPercentage() != null) {
                        dupMsg += " — " + f.getSimilarityPercentage() + "% similar";
                    }
                    addRow(evTable, "Duplicate", dupMsg, bold, regular, mutedColor);
                }
                document.add(evTable);
            }
        }

        // Timeline
        document.add(new LineSeparator(new SolidLine(0.5f)).setMarginTop(12));
        document.add(new Paragraph("CASE TIMELINE")
                .setFont(bold).setFontSize(13).setFontColor(headerColor).setMarginTop(12).setMarginBottom(5));
        if (timeline.isEmpty()) {
            document.add(new Paragraph("No timeline events recorded.").setFont(regular).setFontSize(10).setFontColor(mutedColor));
        } else {
            for (Map<String, Object> evt : timeline) {
                String eventName = String.valueOf(evt.getOrDefault("event", ""));
                String details = String.valueOf(evt.getOrDefault("details", ""));
                Object dateObj = evt.get("date");
                String dateStr = dateObj != null ? dateObj.toString() : "";
                try {
                    LocalDateTime d = LocalDateTime.parse(dateStr.length() > 19 ? dateStr.substring(0, 19) : dateStr);
                    dateStr = d.format(fmt);
                } catch (Exception ignored) {}
                boolean isFlagged = eventName.toLowerCase().contains("flagged");
                DeviceRgb evtColor = isFlagged ? dangerColor : (eventName.toLowerCase().contains("created") ? successColor : accentColor);
                document.add(new Paragraph("• " + eventName + "  [" + dateStr + "]")
                        .setFont(bold).setFontSize(9).setFontColor(evtColor).setMarginTop(4).setMarginBottom(1));
                if (!details.isEmpty()) {
                    document.add(new Paragraph("   " + details).setFont(regular).setFontSize(8.5f).setFontColor(mutedColor).setMarginBottom(1));
                }
            }
        }

        // AI Report
        if (c.getAiReport() != null && !c.getAiReport().trim().isEmpty()) {
            document.add(new LineSeparator(new SolidLine(0.5f)).setMarginTop(12));
            document.add(new Paragraph("AI-GENERATED CASE SUMMARY REPORT")
                    .setFont(bold).setFontSize(13).setFontColor(headerColor).setMarginTop(12).setMarginBottom(5));
            String cleanReport = c.getAiReport()
                    .replaceAll("\\*\\*(.+?)\\*\\*", "$1")
                    .replaceAll("\\*(.+?)\\*", "$1")
                    .replaceAll("#+\\s", "")
                    .replaceAll("`", "");
            document.add(new Paragraph(cleanReport).setFont(regular).setFontSize(9.5f)
                    .setFontColor(new DeviceRgb(30, 41, 59)).setMultipliedLeading(1.4f));
        }

        // Footer
        document.add(new LineSeparator(new SolidLine(0.5f)).setMarginTop(16));
        document.add(new Paragraph("Generated by CrimeEvidence AI  |  Export Time: " + exportTime + "  |  Case #" + c.getId())
                .setFont(regular).setFontSize(8).setFontColor(mutedColor)
                .setTextAlignment(TextAlignment.CENTER).setMarginTop(6));

        document.close();
        return baos.toByteArray();
    }

    private void addRow(Table table, String label, String value, PdfFont labelFont, PdfFont valueFont, DeviceRgb labelColor) {
        table.addCell(new Cell().add(new Paragraph(label).setFont(labelFont).setFontSize(9).setFontColor(labelColor))
                .setBackgroundColor(new DeviceRgb(241, 245, 249)).setPadding(5));
        table.addCell(new Cell().add(new Paragraph(value != null ? value : "-").setFont(valueFont).setFontSize(9))
                .setPadding(5));
    }
}
