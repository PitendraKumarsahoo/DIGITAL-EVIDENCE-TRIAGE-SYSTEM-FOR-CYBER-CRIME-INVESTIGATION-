"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getUser, clearAuth, authFetch, UserInfo } from "@/lib/auth";

interface HeaderProps {
  activeTab?: "cases" | "analytics" | "stations" | "users";
  districts?: string[];
  selectedDistrict?: string;
  onDistrictChange?: (district: string) => void;
}

export default function Header({
  activeTab = "cases",
  districts,
  selectedDistrict = "ALL",
  onDistrictChange,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser && !pathname.startsWith("/login")) {
      router.push("/login");
    } else {
      setUser(currentUser);
    }
  }, [router, pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await authFetch("http://localhost:8080/api/auth/logout", {
        method: "POST",
      });
    } catch (e) {
      console.warn("Logout API call warning:", e);
    } finally {
      clearAuth();
      router.push("/login");
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "US";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const isAdmin = user?.role?.toLowerCase() === "admin";

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white py-4 px-6 sm:px-8 sticky top-0 z-40 shadow-xl backdrop-blur-md bg-slate-900/90">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20 text-white group-hover:scale-105 transition-all duration-200 border border-blue-400/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2 font-mono">
                CEMS <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-950/80 text-cyan-400 font-mono border border-cyan-500/30">v1.2.0</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Cyber Crime Evidence Management System</p>
            </div>
          </Link>
        </div>

        {/* Center/Right Navigation & Filters & User Menu */}
        <div className="flex flex-wrap items-center gap-3 md:gap-4 justify-between md:justify-end">
          
          {/* Main Navigation Links */}
          <nav className="flex items-center gap-1.5 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800 shadow-inner">
            <Link
              href="/"
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === "cases"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              Cases Repository
            </Link>

            <Link
              href="/analytics"
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === "analytics"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              Analytics
            </Link>

            <Link
              href="/admin"
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === "stations"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              Districts Directory
            </Link>

            {isAdmin && (
              <Link
                href="/admin/users"
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "users"
                    ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-500/20"
                    : "text-amber-400 hover:text-amber-300 hover:bg-amber-950/40"
                }`}
              >
                User Admin
              </Link>
            )}
          </nav>

          {/* District Selector (ADMIN ONLY) */}
          {isAdmin && districts && onDistrictChange && (
            <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-blue-500/30 shadow-inner">
              <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">District:</span>
              <select
                value={selectedDistrict}
                onChange={(e) => onDistrictChange(e.target.value)}
                className="bg-slate-900 text-cyan-300 text-xs font-bold rounded-md border border-slate-700 px-2 py-1 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="ALL">All Districts (30)</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* District Scope Badge (INVESTIGATOR ONLY) */}
          {!isAdmin && user?.district && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/70 border border-blue-500/30 text-xs font-bold text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>District: {user.district}</span>
            </div>
          )}

          {/* User Profile Menu & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-all cursor-pointer shadow-sm group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-bold text-xs flex items-center justify-center shadow-md border border-cyan-300/30 font-mono">
                {getInitials(user?.fullName || user?.username)}
              </div>

              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors leading-tight">
                  {user?.fullName || user?.username || "Officer"}
                </p>
                <p className="text-[10px] text-slate-400 font-mono capitalize">
                  {user?.role || "User"} {user?.district ? `• ${user.district}` : ""}
                </p>
              </div>

              <svg
                className={`w-4 h-4 text-slate-400 group-hover:text-white transition-transform ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Box */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 py-2 divide-y divide-slate-800 backdrop-blur-xl bg-slate-900/95 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* User Summary Header */}
                <div className="px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-white">{user?.fullName || "Logged User"}</p>
                  <p className="text-[11px] text-slate-400 font-mono">@{user?.username}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                      {user?.role || "Investigator"}
                    </span>
                    {user?.district && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                        {user.district}
                      </span>
                    )}
                  </div>
                </div>

                {/* Admin Management Link */}
                {isAdmin && (
                  <div className="py-1">
                    <Link
                      href="/admin/users"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-slate-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Manage User Accounts
                    </Link>
                  </div>
                )}

                {/* Logout Button */}
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout from System
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
