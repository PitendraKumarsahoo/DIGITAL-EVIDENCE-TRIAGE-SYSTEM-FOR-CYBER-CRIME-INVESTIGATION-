"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import Header from "@/components/Header";
import { getToken, authFetch } from "@/lib/auth";

// ==========================================
// 1. TYPE DEFINITIONS
// ==========================================

interface Case {
  id: number;
  title: string;
  description: string;
  status: string;
  station?: string;
  createdAt?: string;
  createdDate?: string;
}

interface EvidenceFile {
  id: number;
  filename: string;
  fileType: string;
  uploadDate: string;
  status?: string;
  extractedText?: string;
  flaggedKeywords?: string;
  confidenceScore?: number;
  isSuspicious?: boolean;
  isDuplicate?: boolean;
  duplicateOfId?: number;
  similarityPercentage?: number;
  analysisError?: string;
}

export default function CaseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  
  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
    }
  }, [router]);

  const caseId = params?.id ? String(params.id) : "";

  // ==========================================
  // 2. STATE MANAGEMENT
  // ==========================================
  const [caseObj, setCaseObj] = useState<Case | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceFile[]>([]);
  
  // Loading & Error States
  const [isLoadingCase, setIsLoadingCase] = useState(true);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(true);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  // File Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Text Evidence Upload & Mode States
  const [uploadMode, setUploadMode] = useState<"file" | "text" | "audio">("file");
  const [textContent, setTextContent] = useState("");
  const [isUploadingText, setIsUploadingText] = useState(false);

  // Audio Evidence Upload States
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  // Custom Keyword Search States per file
  const [keywordQueries, setKeywordQueries] = useState<Record<number, string>>({});
  const [keywordResults, setKeywordResults] = useState<
    Record<number, { loading?: boolean; result?: any; error?: string }>
  >({});

  // Expanded OCR text panels tracking
  const [expandedOcrFiles, setExpandedOcrFiles] = useState<Record<number, boolean>>({});

  // Retry analysis states
  const [retryingFiles, setRetryingFiles] = useState<Record<number, boolean>>({});

  // Download report state
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!caseId) return;
    setIsDownloadingPdf(true);
    try {
      const response = await authFetch(`http://localhost:8080/api/cases/${caseId}/export-pdf`);
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Case_${caseId}_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("PDF download error:", err);
      alert("Failed to download PDF report: " + (err.message || "Unknown error"));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleRetryAnalysis = async (evidenceId: number) => {
    setRetryingFiles((prev) => ({ ...prev, [evidenceId]: true }));
    try {
      const response = await authFetch(`http://localhost:8080/api/evidence/${evidenceId}/retry-analysis`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`Retry failed: ${response.status}`);
      await fetchEvidenceFiles();
    } catch (err: any) {
      console.error("Retry analysis error:", err);
    } finally {
      setRetryingFiles((prev) => ({ ...prev, [evidenceId]: false }));
    }
  };

  const toggleOcrExpansion = (fileId: number) => {
    setExpandedOcrFiles((prev) => ({
      ...prev,
      [fileId]: !prev[fileId],
    }));
  };

  const handleUploadText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !textContent.trim()) {
      setUploadError("Please enter text evidence content before submitting.");
      return;
    }

    setIsUploadingText(true);
    setUploadSuccess(null);
    setUploadError(null);

    try {
      const response = await authFetch("http://localhost:8080/api/evidence/upload-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caseId: Number(caseId),
          textContent: textContent.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Upload text evidence failed: Server status ${response.status}`);
      }

      setUploadSuccess("Text evidence successfully submitted and analyzed.");
      setTextContent("");
      await fetchEvidenceFiles();
      await fetchCaseTimeline();
    } catch (err: any) {
      console.error("Text evidence submission error:", err);
      setUploadError(err.message || "Could not submit text evidence.");
    } finally {
      setIsUploadingText(false);
    }
  };

  const handleKeywordSearch = async (evidenceId: number) => {
    const kw = keywordQueries[evidenceId]?.trim();
    if (!kw) return;

    setKeywordResults((prev) => ({
      ...prev,
      [evidenceId]: { loading: true, error: undefined },
    }));

    try {
      const response = await authFetch(`http://localhost:8080/api/evidence/${evidenceId}/search-keyword`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keyword: kw }),
      });

      if (!response.ok) {
        throw new Error(`Keyword search failed: Status ${response.status}`);
      }

      const data = await response.json();
      setKeywordResults((prev) => ({
        ...prev,
        [evidenceId]: { loading: false, result: data },
      }));
    } catch (err: any) {
      console.error("Keyword search error:", err);
      setKeywordResults((prev) => ({
        ...prev,
        [evidenceId]: { loading: false, error: err.message || "Search failed." },
      }));
    }
  };

  const formatKeywordFoundHeader = (result: { keyword: string; found: boolean; occurrences: { page?: number | null; snippet: string }[] }) => {
    if (!result.found || !result.occurrences || result.occurrences.length === 0) return "Keyword Not Found";
    const pages = Array.from(
      new Set(result.occurrences.map((o) => o.page).filter((p): p is number => p !== null && p !== undefined))
    );
    if (pages.length > 0) {
      return `Found on ${pages.map((p) => `Page ${p}`).join(", ")}`;
    }
    return `Found in evidence content`;
  };

  const renderHighlightedSnippet = (snippet: string, keyword: string) => {
    if (!keyword || !snippet) return snippet;
    const parts = snippet.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={i} className="bg-amber-400/30 text-amber-300 font-bold px-1 rounded border border-amber-500/40">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Case Status Management States
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!caseId) return;
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      const response = await authFetch(`http://localhost:8080/api/cases/${caseId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update status: Server returned ${response.status}`);
      }

      // Refresh case details
      await fetchCaseDetails();
      await fetchCaseTimeline();
    } catch (err: any) {
      console.error("Status update error:", err);
      setStatusError(err.message || "An error occurred while updating the case status.");
    } finally {
      setIsUpdatingStatus(false);
      setShowConfirmClose(false);
    }
  };

  // Case Timeline States
  interface TimelineEvent {
    event: string;
    date: string;
    details: string;
  }
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // AI Case Report States
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const fetchSavedReport = useCallback(async () => {
    if (!caseId) return;
    try {
      const response = await authFetch(`http://localhost:8080/api/cases/${caseId}/report`);
      if (response.ok) {
        const text = await response.text();
        if (text && text.trim() !== "" && text !== "null") {
          setAiReport(text);
        }
      }
    } catch (err) {
      console.error("Error fetching saved AI report:", err);
    }
  }, [caseId]);

  const generateReport = async () => {
    if (!caseId) return;
    setIsGeneratingReport(true);
    setReportError(null);
    try {
      const response = await authFetch(`http://localhost:8080/api/cases/${caseId}/generate-report`, {
        method: "POST"
      });
      if (!response.ok) {
        throw new Error(`Failed to generate report: Server returned status ${response.status}`);
      }
      const text = await response.text();
      if (text.includes("failed, please try again")) {
        setReportError(text);
      } else {
        setAiReport(text);
      }
    } catch (err: any) {
      console.error("Generate report error:", err);
      setReportError(err.message || "An unexpected error occurred while generating case report.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const fetchCaseTimeline = useCallback(async () => {
    if (!caseId) return;
    setIsLoadingTimeline(true);
    setTimelineError(null);
    try {
      const response = await authFetch(`http://localhost:8080/api/cases/${caseId}/timeline`);
      if (!response.ok) {
        throw new Error(`Failed to load timeline: Server returned status ${response.status}`);
      }
      const data = await response.json();
      setTimelineEvents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Fetch timeline error:", err);
      setTimelineError(err.message || "Could not retrieve case timeline history.");
    } finally {
      setIsLoadingTimeline(false);
    }
  }, [caseId]);

  // ==========================================
  // 3. DATA FETCHING (GET Case & Evidence)
  // ==========================================
  const fetchCaseDetails = useCallback(async () => {
    if (!caseId) return;
    setIsLoadingCase(true);
    setCaseError(null);
    try {
      const response = await authFetch(`http://localhost:8080/api/cases/${caseId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("The requested case record was not found in the repository.");
        }
        throw new Error(`Failed to load case: Server returned status ${response.status}`);
      }
      const data = await response.json();
      setCaseObj(data);
    } catch (err: any) {
      console.error("Fetch case error:", err);
      setCaseError(err.message || "An unexpected error occurred while loading case details.");
    } finally {
      setIsLoadingCase(false);
    }
  }, [caseId]);

  const fetchEvidenceFiles = useCallback(async () => {
    if (!caseId) return;
    setIsLoadingEvidence(true);
    setEvidenceError(null);
    try {
      const response = await authFetch(`http://localhost:8080/api/evidence/case/${caseId}`);
      if (!response.ok) {
        throw new Error(`Failed to load evidence files: Server returned status ${response.status}`);
      }
      const data = await response.json();
      setEvidenceList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Fetch evidence error:", err);
      setEvidenceError(err.message || "Could not retrieve evidence file inventory.");
    } finally {
      setIsLoadingEvidence(false);
    }
  }, [caseId]);

  // Initial Data Load
  useEffect(() => {
    if (caseId) {
      fetchCaseDetails();
      fetchEvidenceFiles();
      fetchCaseTimeline();
      fetchSavedReport();
    }
  }, [caseId, fetchCaseDetails, fetchEvidenceFiles, fetchCaseTimeline, fetchSavedReport]);

  // ==========================================
  // 4. EVIDENCE FILE UPLOAD (POST Form Data)
  // ==========================================
  const handleUpload = async (fileToUpload: File) => {
    if (!caseId) return;
    setIsUploading(true);
    setUploadSuccess(null);
    setUploadError(null);

    const formData = new FormData();
    formData.append("caseId", caseId);
    formData.append("file", fileToUpload);

    try {
      const response = await authFetch("http://localhost:8080/api/evidence/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: Server returned status ${response.status}`);
      }

      // Refresh files list and show success alert
      setUploadSuccess(`File "${fileToUpload.name}" successfully uploaded and registered in case files.`);
      setSelectedFile(null);
      await fetchEvidenceFiles();
      await fetchCaseTimeline();
    } catch (err: any) {
      console.error("File upload error:", err);
      setUploadError(err.message || "An error occurred while uploading the evidence file.");
    } finally {
      setIsUploading(false);
    }
  };

  // Triggered when file input changes (manual selection)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Automatically trigger upload upon selection
      handleUpload(file);
    }
  };

  // Drag and Drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // Basic validation for common types (images & PDF)
      const isAllowedType = file.type.startsWith("image/") || file.type === "application/pdf";
      if (!isAllowedType) {
        setUploadError("Invalid file format. Please upload an Image or PDF file.");
        return;
      }
      setSelectedFile(file);
      handleUpload(file);
    }
  };

  // ==========================================
  // 5. HELPER FORMATTERS & RENDERING
  // ==========================================
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  // Renders the status badge styling to match the main dashboard layout
  const renderStatusBadge = (status: string) => {
    const normStatus = (status || "").toLowerCase();
    if (normStatus === "open") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Open
        </span>
      );
    } else if (normStatus === "closed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
          Closed
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          {status || "Unknown"}
        </span>
      );
    }
  };

  // Returns appropriate SVG icon based on file type
  const renderFileTypeIcon = (fileType: string) => {
    const type = (fileType || "").toLowerCase();
    if (type.includes("pdf")) {
      return (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            <text x="7" y="18" fill="currentColor" fontSize="6" fontWeight="bold" fontFamily="monospace">PDF</text>
          </svg>
        </div>
      );
    } else if (type.includes("image")) {
      return (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      );
    } else {
      return (
        <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      );
    }
  };

  // ==========================================
  // 6. COMPONENT LAYOUT
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Header activeTab="cases" />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Navigation Action Area */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Case Repository
          </Link>

          {/* Download Report Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 rounded-lg shadow-md shadow-purple-500/20 transition-all cursor-pointer border border-purple-400/30"
          >
            {isDownloadingPdf ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Report</span>
              </>
            )}
          </button>
        </div>


        {/* ==========================================
            A. CASE DETAILS CONTAINER
            ========================================== */}
        {isLoadingCase ? (
          /* Case Details Skeleton Loader */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4 animate-pulse">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-6 w-80 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-4 w-40 bg-slate-100 dark:bg-slate-800 rounded"></div>
              </div>
              <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded"></div>
              <div className="h-4 w-5/6 bg-slate-100 dark:bg-slate-800 rounded"></div>
            </div>
          </div>
        ) : caseError ? (
          /* Case Loading Error Display */
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-6 text-center max-w-2xl mx-auto shadow-sm">
            <div className="inline-flex p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Case Loading Error</h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{caseError}</p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={fetchCaseDetails}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Retry Loading Case
              </button>
            </div>
          </div>
        ) : caseObj ? (
          /* Case Details Display Card */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm shadow-slate-100 dark:shadow-none space-y-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-bold font-mono text-slate-400 uppercase">Case #{caseObj.id}</span>
                  {renderStatusBadge(caseObj.status)}
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">
                    📍 {caseObj.station || "Bhubaneswar Cyber Cell"}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                  {caseObj.title}
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Registered Date: <span className="font-semibold">{formatDate(caseObj.createdAt || caseObj.createdDate)}</span>
                </p>
              </div>

              {/* Case Status Control Buttons */}
              <div className="flex flex-col items-end gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0">
                {caseObj.status?.toLowerCase() === "open" ? (
                  <>
                    {showConfirmClose ? (
                      <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col gap-2 max-w-xs w-full text-right shadow-inner">
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Are you sure you want to close this case?</p>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            disabled={isUpdatingStatus}
                            onClick={() => setShowConfirmClose(false)}
                            className="px-2.5 py-1 text-xs font-bold text-slate-650 bg-slate-100 hover:bg-slate-200 dark:text-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 rounded transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isUpdatingStatus}
                            onClick={() => handleStatusUpdate("closed")}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded shadow transition-all cursor-pointer flex items-center gap-1"
                          >
                            {isUpdatingStatus && (
                              <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                            Yes, Close
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => setShowConfirmClose(true)}
                        className="px-4 py-2 text-xs font-semibold text-rose-600 border border-rose-250 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5 text-rose-550" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        Mark as Closed
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => handleStatusUpdate("open")}
                    className="px-4 py-2 text-xs font-semibold text-emerald-600 border border-emerald-250 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {isUpdatingStatus ? (
                      <svg className="animate-spin h-3.5 w-3.5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-emerald-550" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                      </svg>
                    )}
                    Reopen Case
                  </button>
                )}

                {statusError && (
                  <p className="text-[10px] text-rose-650 dark:text-rose-400 font-semibold mt-1 max-w-xs text-right">{statusError}</p>
                )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Case Narrative / Description</h3>
              <p className="text-sm text-slate-700 dark:text-slate-350 leading-relaxed whitespace-pre-line">
                {caseObj.description || (
                  <span className="text-slate-400 italic">No description has been recorded for this case fileset.</span>
                )}
              </p>
            </div>
          </div>
        ) : null}

        {/* Grid: Upload & Current Files */}
        {caseObj && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* ==========================================
                B. EVIDENCE FILE UPLOAD ZONE
                ========================================== */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upload New Evidence</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Securely attach raw image files or PDF documents to this forensic file case.</p>
                </div>

                {/* Upload Success Alert */}
                {uploadSuccess && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400 p-3.5 rounded-lg text-xs font-semibold flex items-start gap-2.5">
                    <svg className="w-4.5 h-4.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p>{uploadSuccess}</p>
                      <button
                        onClick={() => setUploadSuccess(null)}
                        className="mt-1 text-emerald-600 dark:text-emerald-500 hover:underline cursor-pointer"
                      >
                        Dismiss alert
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload Error Alert */}
                {uploadError && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-400 p-3.5 rounded-lg text-xs font-semibold flex items-start gap-2.5">
                    <svg className="w-4.5 h-4.5 mt-0.5 shrink-0 text-red-600 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p>{uploadError}</p>
                      <button
                        onClick={() => setUploadError(null)}
                        className="mt-1 text-red-600 dark:text-red-500 hover:underline cursor-pointer"
                      >
                        Dismiss alert
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload Mode Switcher Tabs */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setUploadMode("file")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      uploadMode === "file"
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>📁 Upload File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode("text")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      uploadMode === "text"
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>📝 Paste Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode("audio")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      uploadMode === "audio"
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>🎙️ Audio</span>
                  </button>
                </div>

                {/* Mode A: Drag-and-Drop / File Picker Zone */}
                {uploadMode === "file" && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                      isDragOver
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-slate-800 bg-slate-950/50"
                    } ${isUploading ? "pointer-events-none opacity-60" : "cursor-pointer hover:border-slate-700"}`}
                    onClick={() => {
                      const fileInput = document.getElementById("evidence-file-picker");
                      if (fileInput) fileInput.click();
                    }}
                  >
                    <input
                      id="evidence-file-picker"
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={isUploading}
                      onChange={handleFileChange}
                    />
                    
                    {isUploading ? (
                      <div className="space-y-3 py-4">
                        <div className="flex justify-center">
                          <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Uploading file...</p>
                          <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider mt-1">Encrypting & analyzing payload</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 py-2">
                        <div className="flex justify-center text-slate-400">
                          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">
                            Drag and drop file here, or <span className="text-cyan-400 hover:underline">browse</span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">Supports Images (PNG, JPG) and PDF documents</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode B: Paste Text Evidence Form */}
                {uploadMode === "text" && (
                  <form onSubmit={handleUploadText} className="space-y-3">
                    <textarea
                      rows={5}
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Paste text evidence content here (e.g. chat log transcript, SMS history, officer notes)..."
                      className="w-full px-3.5 py-2.5 bg-slate-950 text-white placeholder-slate-500 rounded-xl border border-slate-800 text-xs font-mono resize-none focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="submit"
                      disabled={isUploadingText || !textContent.trim()}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 border border-cyan-400/30"
                    >
                      {isUploadingText ? (
                        <span>ANALYZING TEXT PAYLOAD...</span>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          <span>SUBMIT TEXT EVIDENCE</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Mode C: Audio Evidence Upload */}
                {uploadMode === "audio" && (
                  <div className="space-y-3">
                    <div
                      className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                        isUploadingAudio ? "opacity-60 pointer-events-none" : "cursor-pointer hover:border-slate-700"
                      } ${audioFile ? "border-purple-600 bg-purple-950/20" : "border-slate-800 bg-slate-950/50"}`}
                      onClick={() => { const el = document.getElementById("audio-file-picker"); if (el) el.click(); }}
                    >
                      <input
                        id="audio-file-picker"
                        type="file"
                        accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a"
                        className="hidden"
                        disabled={isUploadingAudio}
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setAudioFile(f);
                          setUploadError(null);
                        }}
                      />
                      {audioFile ? (
                        <div className="space-y-2 py-1">
                          <span className="text-2xl">🎙️</span>
                          <p className="text-xs font-bold text-purple-300">{audioFile.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{(audioFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      ) : (
                        <div className="space-y-2 py-2">
                          <span className="text-3xl text-slate-400">🎙️</span>
                          <p className="text-xs font-semibold text-white mt-1">Click to select audio file</p>
                          <p className="text-[10px] text-slate-400">Supports MP3, WAV, OGG, FLAC</p>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={isUploadingAudio || !audioFile}
                      onClick={async () => {
                        if (!audioFile || !caseId) return;
                        setIsUploadingAudio(true);
                        setUploadError(null);
                        try {
                          const formData = new FormData();
                          formData.append("caseId", caseId);
                          formData.append("audio", audioFile);
                          const res = await authFetch("http://localhost:8080/api/evidence/upload-audio", {
                            method: "POST",
                            body: formData,
                          });
                          if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
                          setUploadSuccess(`Audio evidence "${audioFile.name}" uploaded and transcribed successfully!`);
                          setAudioFile(null);
                          setUploadMode("file");
                          await fetchEvidenceFiles();
                        } catch (err: any) {
                          setUploadError(err.message || "Audio upload failed.");
                        } finally {
                          setIsUploadingAudio(false);
                        }
                      }}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 border border-purple-400/30"
                    >
                      {isUploadingAudio ? (
                        <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>TRANSCRIBING AUDIO...</span></>
                      ) : (
                        <><span>🎙️</span><span>SUBMIT AUDIO EVIDENCE</span></>
                      )}
                    </button>
                  </div>
                )}

                {/* File Details display card if selected (not yet fully uploaded / during state transitions) */}
                {selectedFile && (
                  <div className="bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      {renderFileTypeIcon(selectedFile.type)}
                      <div className="truncate">
                        <p className="font-semibold text-slate-850 dark:text-slate-100 truncate">{selectedFile.name}</p>
                        <p className="text-slate-400 font-mono">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Case Event Timeline */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500 dark:text-slate-450" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Case Event Timeline
                  </h3>
                  <p className="text-xs text-slate-555 dark:text-slate-400 mt-0.5">Chronological audit ledger of case activity and AI threat scans.</p>
                </div>

                {isLoadingTimeline ? (
                  <div className="space-y-4 py-3">
                    <div className="flex gap-4">
                      <div className="w-2.5 h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-1.5 ring-4 ring-slate-100 dark:ring-slate-800/40"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-24 bg-slate-250 dark:bg-slate-800 rounded"></div>
                        <div className="h-3 w-40 bg-slate-100 dark:bg-slate-850 rounded"></div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-2.5 h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-1.5 ring-4 ring-slate-100 dark:ring-slate-800/40"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-32 bg-slate-250 dark:bg-slate-800 rounded"></div>
                        <div className="h-3 w-28 bg-slate-100 dark:bg-slate-850 rounded"></div>
                      </div>
                    </div>
                  </div>
                ) : timelineError ? (
                  <p className="text-xs text-rose-600 dark:text-rose-450">{timelineError}</p>
                ) : timelineEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No event logs recorded for this case.</p>
                ) : (
                  <div className="relative border-l border-slate-200 dark:border-slate-800 ml-2 pl-5 space-y-5.5 py-1.5">
                    {timelineEvents.map((evt, idx) => {
                      const isFlagged = evt.event.toLowerCase().includes("flagged");
                      const isCreated = evt.event.toLowerCase().includes("created");
                      
                      let dotColorClass = "bg-blue-500 ring-4 ring-blue-500/10";
                      if (isFlagged) {
                        dotColorClass = "bg-rose-500 ring-4 ring-rose-500/10";
                      } else if (isCreated) {
                        dotColorClass = "bg-emerald-500 ring-4 ring-emerald-500/10";
                      }

                      return (
                        <div key={idx} className="relative group">
                          {/* Dot centered on border-l line */}
                          <div className={`absolute -left-[25px] top-[4px] w-2.5 h-2.5 rounded-full transition-all group-hover:scale-110 ${dotColorClass} border border-white dark:border-slate-900`}></div>
                          
                          {/* Event Text */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between items-baseline gap-2 flex-wrap">
                              <span className={`text-xs font-bold ${isFlagged ? "text-rose-600 dark:text-rose-400" : isCreated ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-250"}`}>
                                {evt.event}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                {formatDate(evt.date)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                              {evt.details}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ==========================================
                C. EVIDENCE LISTING REPOSITORY
                ========================================== */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Evidence Case Files</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Inventory of forensic evidence files attached to this crime record.</p>
                  </div>
                  {!isLoadingEvidence && (
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-bold font-mono border border-slate-200/50 dark:border-slate-700/50">
                      {evidenceList.length} FILES
                    </span>
                  )}
                </div>

                {/* Evidence List Loading Skeleton */}
                {isLoadingEvidence ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex gap-3.5 animate-pulse">
                        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                          <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded"></div>
                          <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : evidenceError ? (
                  /* Evidence Retrieve Error Display */
                  <div className="p-6 text-center border border-dashed border-red-200 dark:border-red-900/40 rounded-xl bg-red-50/10">
                    <p className="text-sm text-red-600 dark:text-red-400 font-semibold">{evidenceError}</p>
                    <button
                      onClick={fetchEvidenceFiles}
                      className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Reload evidence vault
                    </button>
                  </div>
                ) : evidenceList.length === 0 ? (
                  /* Empty State - No Evidence Attached */
                  <div className="p-8 text-center border border-dashed border-slate-250 dark:border-slate-800/80 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 max-w-md mx-auto space-y-3">
                    <div className="inline-flex p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H5z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Evidence Registered</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This active cyber case currently contains no uploaded evidence payloads. Upload a file on the left to begin.</p>
                    </div>
                  </div>
                ) : (
                  /* Evidence Files Grid Layout */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {evidenceList.map((file) => (
                      <div
                        key={file.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700/85 hover:shadow-sm rounded-xl p-4 flex flex-col gap-3.5 transition-all"
                      >
                        <div className="flex gap-3.5">
                          {/* File Type Icon */}
                          <div className="shrink-0">
                            {renderFileTypeIcon(file.fileType)}
                          </div>

                          {/* File Details */}
                          <div className="flex-1 min-w-0">
                            <h4
                              className="text-sm font-semibold text-slate-900 dark:text-slate-250 truncate"
                              title={file.filename}
                            >
                              {file.filename}
                            </h4>
                            <p className="text-xs text-slate-450 dark:text-slate-400 font-mono mt-0.5 truncate uppercase">
                              {file.fileType || "application/octet-stream"}
                            </p>
                            
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mt-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z" />
                              </svg>
                              <span>Uploaded: {formatDate(file.uploadDate)}</span>
                            </div>

                            {/* Render Duplicate Warning Badge */}
                            {file.isDuplicate === true && (
                              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-250 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/60">
                                <span>
                                  ⚠ Possible Duplicate (Matches File ID: #{file.duplicateOfId})
                                  {file.similarityPercentage !== undefined && file.similarityPercentage !== null && (
                                    <span className="ml-1 font-mono">— {file.similarityPercentage}% similar</span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* AI Analysis Details */}
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">AI Threat Analysis</span>
                            {/* Render AI Status Badge */}
                            {file.status === "FAILED" ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900">
                                ❌ Analysis Failed
                              </span>
                            ) : file.status === "PENDING" ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-650 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 animate-pulse">
                                ⏳ Pending
                              </span>
                            ) : file.status === "SKIPPED" || file.extractedText?.includes("skipped") ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                🚫 Skipped (Non-Image/PDF)
                              </span>
                            ) : file.isSuspicious === true ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900">
                                ⚠ Suspicious Content Detected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900">
                                ✓ Clean
                              </span>
                            )}
                          </div>

                          {/* Retry Analysis Button for FAILED or PENDING */}
                          {(file.status === "FAILED" || file.status === "PENDING") && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => handleRetryAnalysis(file.id)}
                                disabled={retryingFiles[file.id]}
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer disabled:opacity-60 shadow-sm border border-blue-400/30"
                              >
                                {retryingFiles[file.id] ? (
                                  <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Retrying...</span></>
                                ) : (
                                  <><span>🔄</span><span>Retry Analysis</span></>
                                )}
                              </button>
                              {file.analysisError && (
                                <span className="text-[10px] text-rose-400 font-mono">{file.analysisError}</span>
                              )}
                            </div>
                          )}

                          {/* Threat Confidence Progress Bar for Analyzed files */}
                          {(file.status === "COMPLETED" || (file.status === undefined && file.isSuspicious !== undefined && !file.extractedText?.includes("pending") && !file.extractedText?.includes("failed"))) && (
                            <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/80">
                              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-350">
                                <span>Threat Confidence:</span>
                                <span className="font-mono">{((file.confidenceScore || 0) * 100).toFixed(0)}% confidence</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${file.isSuspicious ? "bg-rose-500 dark:bg-rose-600" : "bg-emerald-500"}`} 
                                  style={{ width: `${(file.confidenceScore || 0) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                          {/* Extra info for suspicious files - Flagged Keywords */}
                          {file.isSuspicious === true && file.flaggedKeywords && (
                            <div className="flex gap-1.5 flex-wrap items-center p-2.5 rounded-lg bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
                              <span className="text-[10px] text-slate-550 dark:text-slate-400 uppercase font-bold tracking-wider">Flagged Keywords:</span>
                              {file.flaggedKeywords.split(",").map((kw) => (
                                <span key={kw} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-mono border border-amber-250/50 dark:border-amber-700/50">
                                  {kw.trim()}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Collapsible Extracted Text section if OCR has text */}
                          {file.extractedText && (
                            <div className="space-y-1">
                              <button
                                onClick={() => toggleOcrExpansion(file.id)}
                                className="w-full text-left text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold flex items-center justify-between py-1 cursor-pointer"
                              >
                                <span>{expandedOcrFiles[file.id] ? "Hide Extracted Text" : "View Extracted Text (OCR)"}</span>
                                <svg
                                  className={`w-3.5 h-3.5 transform transition-transform ${expandedOcrFiles[file.id] ? "rotate-180" : ""}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              {expandedOcrFiles[file.id] && (
                                <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-350 max-h-36 overflow-y-auto whitespace-pre-wrap break-all leading-normal">
                                  {file.extractedText}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Custom Keyword Search Block */}
                          <div className="border-t border-slate-800 pt-3 space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Search for specific keyword (optional)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="e.g. drug, transaction, fraud..."
                                value={keywordQueries[file.id] || ""}
                                onChange={(e) =>
                                  setKeywordQueries((prev) => ({
                                    ...prev,
                                    [file.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleKeywordSearch(file.id);
                                  }
                                }}
                                className="flex-1 px-3 py-1.5 bg-slate-950 text-white placeholder-slate-500 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-cyan-400"
                              />
                              <button
                                type="button"
                                onClick={() => handleKeywordSearch(file.id)}
                                disabled={keywordResults[file.id]?.loading || !keywordQueries[file.id]?.trim()}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0 border border-cyan-400/30"
                              >
                                {keywordResults[file.id]?.loading ? (
                                  <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <>
                                    <span>🔍</span>
                                    <span>Search</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Keyword Search Result Container */}
                            {keywordResults[file.id] && (
                              <div className="mt-2 text-xs">
                                {keywordResults[file.id].loading && (
                                  <p className="text-[11px] text-cyan-400 font-mono animate-pulse">
                                    Scanning document pages for "{keywordQueries[file.id]}"...
                                  </p>
                                )}

                                {keywordResults[file.id].error && (
                                  <p className="text-[11px] text-rose-400">
                                    {keywordResults[file.id].error}
                                  </p>
                                )}

                                {keywordResults[file.id].result && (
                                  <div className="space-y-2 mt-1.5">
                                    {keywordResults[file.id].result.found ? (
                                      <div className="p-3 bg-cyan-950/40 border border-cyan-800/80 rounded-xl space-y-2">
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                                          <span className="font-bold text-cyan-300">
                                            {formatKeywordFoundHeader(keywordResults[file.id].result)}
                                          </span>
                                        </div>

                                        <div className="space-y-2">
                                          {keywordResults[file.id].result.occurrences?.map((occ: any, i: number) => (
                                            <div key={i} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                                              {occ.page !== null && occ.page !== undefined && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-cyan-300 font-mono border border-blue-800">
                                                  Page {occ.page}
                                                </span>
                                              )}
                                              <p className="text-slate-300 font-mono text-[11px] leading-relaxed">
                                                {renderHighlightedSnippet(occ.snippet, keywordResults[file.id].result.keyword)}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="p-2.5 bg-rose-950/30 border border-rose-900/60 rounded-xl text-rose-300 font-medium text-center flex items-center justify-center gap-2">
                                        <span>❌</span>
                                        <span>Keyword "{keywordResults[file.id].result.keyword}" not found</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Investigation Report Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      AI Case Summary Report
                    </h3>
                    <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5">Automated narrative intelligence summarizing case details and scanned evidence findings.</p>
                  </div>
                  {aiReport && !isGeneratingReport && (
                    <button
                      onClick={generateReport}
                      className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded transition-all cursor-pointer flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                      </svg>
                      Regenerate
                    </button>
                  )}
                </div>

                {isGeneratingReport ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-3 text-center">
                    <svg className="animate-spin h-7 w-7 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-slate-850 dark:text-slate-250">Generating Narrative Report...</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Gemini is compiling evidence and drafting summary.</p>
                    </div>
                  </div>
                ) : reportError ? (
                  <div className="p-4 bg-red-50/20 border border-red-200 dark:border-red-950/20 rounded-xl space-y-3">
                    <p className="text-xs text-rose-600 dark:text-rose-450 font-semibold">{reportError}</p>
                    <button
                      onClick={generateReport}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow transition-all cursor-pointer"
                    >
                      Retry Report Generation
                    </button>
                  </div>
                ) : aiReport ? (
                  <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 p-5 rounded-xl space-y-3 max-h-[400px] overflow-y-auto shadow-inner">
                    <div className="max-w-none text-slate-700 dark:text-[#CBD5E1] text-xs">
                      <ReactMarkdown
                        components={{
                          h1: ({ node, ...props }) => (
                            <h1 className="text-lg font-bold text-slate-900 dark:text-[#F8FAFC] mt-5 mb-2.5 first:mt-0" {...props} />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] mt-4 mb-2 first:mt-0" {...props} />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC] mt-3.5 mb-1.5 first:mt-0" {...props} />
                          ),
                          p: ({ node, ...props }) => (
                            <p className="text-xs text-slate-650 dark:text-[#CBD5E1] leading-relaxed my-3 last:mb-0" {...props} />
                          ),
                          strong: ({ node, ...props }) => (
                            <strong className="font-bold text-slate-950 dark:text-[#93C5FD]" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-5 space-y-1.5 my-3 text-xs text-slate-650 dark:text-[#CBD5E1]" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-5 space-y-1.5 my-3 text-xs text-slate-650 dark:text-[#CBD5E1]" {...props} />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="text-xs text-slate-650 dark:text-[#CBD5E1] leading-relaxed" {...props} />
                          ),
                          code: ({ node, ...props }) => (
                            <code className="text-[11px] font-mono bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-[#BAE6FD] px-1 py-0.5 rounded border border-slate-200 dark:border-slate-800" {...props} />
                          ),
                          pre: ({ node, ...props }) => (
                            <pre className="p-3 my-3 overflow-x-auto bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] leading-normal" {...props} />
                          ),
                        }}
                      >
                        {aiReport}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-950/10 space-y-3">
                    <p className="text-xs text-slate-550 dark:text-slate-400 max-w-sm mx-auto">
                      No Case Report Generated. Generate an AI case summary report using raw case evidence and OCR payload text.
                    </p>
                    <button
                      onClick={generateReport}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-650 hover:bg-purple-750 hover:shadow rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate AI Report
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* CEMS Footer */}
      <footer className="mt-auto bg-slate-900 border-t border-slate-800 text-slate-500 py-4 px-6 text-center text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>© {new Date().getFullYear()} Cyber Evidence Management System (CEMS). Secure Node Environment.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 transition-colors">Privacy Protocol</span>
            <span className="hover:text-slate-400 transition-colors">Audit Logs</span>
            <span className="hover:text-slate-400 transition-colors">Compliance v2.1</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
