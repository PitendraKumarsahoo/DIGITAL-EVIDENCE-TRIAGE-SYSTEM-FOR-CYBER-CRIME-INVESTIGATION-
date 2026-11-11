"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { getUser, getToken, authFetch, apiUrl, UserInfo } from "@/lib/auth";

interface Case {
  id: number;
  title: string;
  description: string;
  status: string;
  station?: string;
  district?: string;
  createdAt?: string;
  createdDate?: string;
}

export default function CaseManagementDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);

  // Cases & Search
  const [cases, setCases] = useState<Case[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // District filter states
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("ALL");

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState("open");
  const [newDistrict, setNewDistrict] = useState("Khordha");
  const [districtSearchQuery, setDistrictSearchQuery] = useState("");
  const [isDistrictDropdownOpen, setIsDistrictDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Route protection & User state initialization
  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !user) {
      router.push("/login");
      return;
    }
    setCurrentUser(user);

    if (user.role?.toLowerCase() === "investigator" && user.district) {
      setSelectedDistrict(user.district);
      setNewDistrict(user.district);
    }
  }, [router]);

  // Fetch districts list
  useEffect(() => {
    fetch(apiUrl("/api/districts"))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDistricts(data);
        }
      })
      .catch((err) => console.warn("Could not fetch districts list:", err));
  }, []);

  // Fetch Cases from API with Authentication
  const fetchCases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authFetch("http://localhost:8080/api/cases");
      if (!response.ok) {
        throw new Error(`Failed to fetch cases: Server status ${response.status}`);
      }
      const data = await response.json();
      setCases(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("API error:", err);
      setError(err.message || "An unexpected error occurred while loading cases.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getToken()) {
      fetchCases();
    }
  }, [fetchCases]);

  // Create Case handler
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setSubmitError("Case title is required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await authFetch("http://localhost:8080/api/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          status: newStatus,
          district: newDistrict,
          station: newDistrict,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create case: Server returned status ${response.status}`);
      }

      setNewTitle("");
      setNewDescription("");
      setNewStatus("open");
      setIsModalOpen(false);

      await fetchCases();
    } catch (err: any) {
      console.error("Submit error:", err);
      setSubmitError(err.message || "Could not save new case. Please verify backend connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Role-based District Filtering
  const isAdmin = currentUser?.role?.toLowerCase() === "admin";
  const userDistrict = currentUser?.district;

  const districtFilteredCases = cases.filter((c) => {
    const caseDist = c.district || c.station || "";
    if (isAdmin) {
      if (selectedDistrict === "ALL") return true;
      return caseDist.toLowerCase() === selectedDistrict.toLowerCase();
    } else {
      // Investigator: restrict strictly to their own assigned district
      if (!userDistrict) return true;
      return caseDist.toLowerCase() === userDistrict.toLowerCase();
    }
  });

  // Client-side Search Query Filter
  const filteredCases = districtFilteredCases.filter((item) =>
    item.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCount = districtFilteredCases.length;
  const openCount = districtFilteredCases.filter((c) => c.status?.toLowerCase() === "open").length;
  const closedCount = districtFilteredCases.filter((c) => c.status?.toLowerCase() === "closed").length;

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

  const renderStatusBadge = (status: string) => {
    const normStatus = (status || "").toLowerCase();
    if (normStatus === "open") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-950/50 text-emerald-400 border border-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Open
        </span>
      );
    } else if (normStatus === "closed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          Closed
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-950/50 text-amber-400 border border-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          {status || "Pending"}
        </span>
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Header Navigation */}
      <Header
        activeTab="cases"
        districts={districts}
        selectedDistrict={selectedDistrict}
        onDistrictChange={setSelectedDistrict}
      />

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Role Scoping Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-950 text-cyan-400 rounded-xl border border-blue-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Jurisdiction Evidence Repository
                {isAdmin ? (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-bold">
                    Admin View ({selectedDistrict === "ALL" ? "All 30 Districts" : selectedDistrict})
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-950 text-cyan-400 border border-blue-800 font-bold">
                    Investigator Scope ({userDistrict || "Assigned District"})
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {isAdmin
                  ? "Full systemic access across all 30 Odisha police districts and cyber cells."
                  : `Filtered view displaying cases strictly assigned to ${userDistrict || "your district"}.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchCases}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <svg className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
              </svg>
              Refresh Repository
            </button>
          </div>
        </div>

        {/* Dynamic Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Active Cases</p>
              <h3 className="text-3xl font-extrabold mt-1 text-white">
                {isLoading ? "..." : totalCount}
              </h3>
            </div>
            <div className="p-3 bg-slate-800 text-blue-400 rounded-xl border border-slate-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Investigations</p>
              <h3 className="text-3xl font-extrabold mt-1 text-emerald-400">
                {isLoading ? "..." : openCount}
              </h3>
            </div>
            <div className="p-3 bg-emerald-950/40 text-emerald-400 rounded-xl border border-emerald-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Closed / Archived</p>
              <h3 className="text-3xl font-extrabold mt-1 text-slate-400">
                {isLoading ? "..." : closedCount}
              </h3>
            </div>
            <div className="p-3 bg-slate-800 text-slate-400 rounded-xl border border-slate-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Search Bar & Create Case Trigger */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          
          <div className="relative w-full sm:max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search cases by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs placeholder-slate-500 text-white focus:outline-none focus:border-cyan-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-xl shadow-lg shadow-cyan-500/20 transition-all cursor-pointer border border-cyan-400/30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            REGISTER NEW CASE
          </button>
        </div>

        {/* Data Table Area */}
        {error ? (
          <div className="bg-rose-950/40 border border-rose-800 rounded-2xl p-6 text-center max-w-xl mx-auto">
            <h3 className="text-base font-bold text-rose-300">Connection Error</h3>
            <p className="text-xs text-rose-400 mt-1">{error}</p>
            <button
              onClick={fetchCases}
              className="mt-4 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : isLoading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-slate-800/80 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-md mx-auto">
            <p className="text-sm font-bold text-white">No evidence cases found</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? `No titles match "${searchQuery}" in ${selectedDistrict === "ALL" ? "any district" : selectedDistrict}.`
                : `No case records exist for district ${selectedDistrict === "ALL" ? "repository" : selectedDistrict}.`}
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Active Cases Inventory
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-cyan-400 font-mono">
                  {filteredCases.length} items
                </span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">Sorted by ID</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/90 text-slate-300 font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-4 w-16">ID</th>
                    <th className="p-4">Case Title</th>
                    <th className="p-4 text-center">District / Cyber Cell</th>
                    <th className="p-4">Description Summary</th>
                    <th className="p-4 text-center w-28">Status</th>
                    <th className="p-4 w-44">Registered Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-medium">
                  {filteredCases.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/cases/${item.id}`)}
                      className="hover:bg-slate-850/70 transition-colors cursor-pointer"
                    >
                      <td className="p-4 font-mono text-slate-400 font-bold">
                        #{item.id}
                      </td>

                      <td className="p-4 text-sm font-bold text-white">
                        <Link href={`/cases/${item.id}`} className="hover:text-cyan-400 transition-colors">
                          {item.title}
                        </Link>
                      </td>

                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-blue-950 text-cyan-300 border border-blue-800 font-mono">
                          📍 {item.district || item.station || "Khordha"}
                        </span>
                      </td>

                      <td className="p-4 text-slate-300 max-w-sm truncate">
                        {item.description || <span className="text-slate-500 italic">No description</span>}
                      </td>

                      <td className="p-4 text-center">
                        {renderStatusBadge(item.status)}
                      </td>

                      <td className="p-4 text-slate-400 font-mono">
                        {formatDate(item.createdAt || item.createdDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* Case Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !isSubmitting && setIsModalOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
          ></div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden backdrop-blur-2xl">
            <div className="bg-slate-950 p-5 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-900/40 text-cyan-400 rounded-xl border border-cyan-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Register Cyber Crime Case</h3>
                  <p className="text-[10px] text-slate-400 font-mono uppercase">Node Ingestion Portal</p>
                </div>
              </div>

              <button
                disabled={isSubmitting}
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-rose-950 border border-rose-800 text-rose-300 text-xs font-semibold rounded-xl">
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Case Title *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  placeholder="e.g. PHISHING FRAUD - STATE HEALTH DEPT"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 text-white rounded-xl border border-slate-700 text-xs font-medium focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Assigned Odisha District *
                </label>
                {isAdmin ? (
                  <div className="relative">
                    <div className="relative">
                      <input
                        type="text"
                        disabled={isSubmitting}
                        placeholder="Search & select district (e.g. Cuttack)..."
                        value={isDistrictDropdownOpen ? districtSearchQuery : newDistrict}
                        onFocus={() => {
                          setIsDistrictDropdownOpen(true);
                          setDistrictSearchQuery("");
                        }}
                        onChange={(e) => {
                          setDistrictSearchQuery(e.target.value);
                          setIsDistrictDropdownOpen(true);
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-950 text-white rounded-xl border border-slate-700 text-xs font-semibold focus:outline-none focus:border-cyan-400"
                      />
                      <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        🔍
                      </span>
                    </div>

                    {isDistrictDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 text-xs">
                        {districts
                          .filter((d) => d.toLowerCase().includes(districtSearchQuery.toLowerCase()))
                          .map((d) => (
                            <div
                              key={d}
                              onClick={() => {
                                setNewDistrict(d);
                                setIsDistrictDropdownOpen(false);
                                setDistrictSearchQuery("");
                              }}
                              className={`px-3.5 py-2 cursor-pointer font-medium hover:bg-blue-950 hover:text-cyan-300 transition-colors ${
                                newDistrict === d ? "bg-blue-900/60 text-cyan-400 font-bold" : "text-slate-200"
                              }`}
                            >
                              📍 {d}
                            </div>
                          ))}
                        {districts.filter((d) => d.toLowerCase().includes(districtSearchQuery.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-slate-500 italic text-center">No district matches search</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      disabled
                      value={userDistrict || "Khordha"}
                      className="w-full px-3.5 py-2.5 bg-slate-950 text-slate-400 rounded-xl border border-slate-800 text-xs font-mono font-bold cursor-not-allowed pl-9"
                    />
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      🔒
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1">Locked to your assigned district (Investigator Scope)</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Initial Case Status
                </label>
                <select
                  disabled={isSubmitting}
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 text-white rounded-xl border border-slate-700 text-xs font-semibold focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Case Description & Synopsis
                </label>
                <textarea
                  rows={4}
                  disabled={isSubmitting}
                  placeholder="Enter details about compromised endpoints, digital evidence, involved threat vectors..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 text-white rounded-xl border border-slate-700 text-xs font-medium focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-xl shadow-md cursor-pointer border border-cyan-400/30"
                >
                  {isSubmitting ? "Registering..." : "SAVE CASE RECORD"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto bg-slate-900 border-t border-slate-800 text-slate-500 py-4 px-6 text-center text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>© {new Date().getFullYear()} Cyber Evidence Management System (CEMS). Authenticated Access.</p>
          <div className="flex gap-4">
            <span>District Repository</span>
            <span>v1.2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
