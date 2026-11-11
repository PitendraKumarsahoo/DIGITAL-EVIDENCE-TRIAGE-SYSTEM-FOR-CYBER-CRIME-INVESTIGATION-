"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { getUser, getToken, authFetch, apiUrl, UserInfo } from "@/lib/auth";

interface UserRecord {
  id?: number;
  username: string;
  fullName: string;
  role: string;
  district: string;
  createdDate?: string;
}

export default function UserManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);

  // Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("investigator");
  const [district, setDistrict] = useState("Khordha");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // User inventory list
  const [users, setUsers] = useState<UserRecord[]>([
    { username: "admin", fullName: "System Administrator", role: "admin", district: "Khordha" },
    { username: "investigator", fullName: "Inspector Das", role: "investigator", district: "Khordha" },
    { username: "cuttack_investigator", fullName: "Inspector Mishra", role: "investigator", district: "Cuttack" },
  ]);

  useEffect(() => {
    const user = getUser();
    if (!getToken() || !user) {
      router.push("/login");
      return;
    }
    if (user.role?.toLowerCase() !== "admin") {
      // Non-admin restricted
      router.push("/");
      return;
    }
    setCurrentUser(user);

    // Fetch districts list
    fetch(apiUrl("/api/districts"))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDistricts(data);
          if (data.length > 0) setDistrict(data[0]);
        }
      })
      .catch((e) => console.warn("Failed to fetch districts:", e));
  }, [router]);

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!username.trim() || !password.trim() || !fullName.trim()) {
      setErrorMsg("Please complete all required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authFetch("http://localhost:8080/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          fullName: fullName.trim(),
          role: role,
          district: district,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Registration failed: Status ${response.status}`);
      }

      setSuccessMsg(`User "${username}" created successfully! Role: ${role}, District: ${district}`);
      
      // Append to list
      setUsers((prev) => [
        ...prev,
        {
          username: username.trim(),
          fullName: fullName.trim(),
          role: role,
          district: district,
        },
      ]);

      // Reset form
      setUsername("");
      setPassword("");
      setFullName("");
      setRole("investigator");
    } catch (err: any) {
      console.error("User registration error:", err);
      setErrorMsg(err.message || "Could not register user. Make sure you are logged in as admin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <Header activeTab="users" />

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span className="p-2 bg-amber-950 text-amber-400 rounded-xl border border-amber-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              User & Officer Account Management
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Admin console to create investigator accounts and manage district assignments.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300">Logged as Admin: </span>
            <span className="text-amber-400 font-bold">{currentUser?.fullName}</span>
          </div>
        </div>

        {/* Top Section: Form to Create User */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Create New Officer / User Account
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            Add a new investigator or administrator and assign their jurisdiction district.
          </p>

          {/* Feedback Messages */}
          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-3">
              <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleRegisterUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Full Officer Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Inspector Rajesh Mohanty"
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 text-white placeholder-slate-500 rounded-xl border border-slate-700 text-xs font-medium focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Username *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. rmohanty"
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 text-white placeholder-slate-500 rounded-xl border border-slate-700 text-xs font-medium focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Password *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 text-white placeholder-slate-500 rounded-xl border border-slate-700 text-xs font-medium focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Role *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 text-white rounded-xl border border-slate-700 text-xs font-semibold focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="investigator">Investigator (District Scoped)</option>
                <option value="admin">Administrator (All Districts Access)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Assigned Odisha District *
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 text-white rounded-xl border border-slate-700 text-xs font-semibold focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-400/30"
              >
                {isSubmitting ? (
                  <span>CREATING USER...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>CREATE USER ACCOUNT</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Section: Users Inventory Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">System User Directory</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                List of registered personnel with assigned roles & district permissions.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-slate-800 text-amber-400 font-mono font-bold rounded border border-slate-700">
              {users.length} ACCOUNTS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800 text-slate-300 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Officer / User Name</th>
                  <th className="p-3.5">Username</th>
                  <th className="p-3.5 text-center">System Role</th>
                  <th className="p-3.5 text-center">Assigned District</th>
                  <th className="p-3.5 text-right rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-medium">
                {users.map((u, idx) => (
                  <tr key={idx} className="hover:bg-slate-850/60 transition-colors">
                    <td className="p-3.5 font-bold text-white flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 text-amber-400 font-bold font-mono flex items-center justify-center border border-slate-700">
                        {u.fullName ? u.fullName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{u.fullName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">ID #{1001 + idx}</p>
                      </div>
                    </td>

                    <td className="p-3.5 font-mono text-cyan-300 font-semibold">
                      @{u.username}
                    </td>

                    <td className="p-3.5 text-center">
                      {u.role?.toLowerCase() === "admin" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-400 border border-amber-800 font-mono">
                          👑 Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-950/80 text-blue-400 border border-blue-800 font-mono">
                          🔍 Investigator
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        {u.district || "Khordha"}
                      </span>
                    </td>

                    <td className="p-3.5 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
