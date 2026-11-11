"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setAuth, getToken, apiUrl } from "@/lib/auth";

const ODISHA_DISTRICTS = [
  "Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh",
  "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur",
  "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar",
  "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh",
  "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDemoDistrict, setSelectedDemoDistrict] = useState<string>("");

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (getToken()) {
      router.push("/");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Login failed: Server returned status ${response.status}`);
      }

      if (data.token) {
        setAuth(data.token, {
          username: data.username,
          fullName: data.fullName,
          role: data.role,
          district: data.district,
        });
        router.push("/");
      } else {
        throw new Error("No authentication token received from server.");
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(err.message || "Invalid username or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickUser = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  const handleDistrictSelect = (district: string) => {
    setSelectedDemoDistrict(district);
    if (district) {
      const slug = district.toLowerCase().replace(/\s+/g, "_");
      fillQuickUser(`investigator_${slug}`, "Demo@123");
    }
  };

  return (
    <div className="relative min-h-screen bg-[#070D1E] text-slate-100 flex items-center justify-center p-4 overflow-hidden font-sans selection:bg-cyan-500 selection:text-slate-950">
      
      {/* Background Animated Gradient Blobs & Glowing Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/20 to-cyan-500/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-10 left-10 w-[350px] h-[350px] bg-cyan-600/15 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-10 right-10 w-[400px] h-[400px] bg-indigo-600/15 rounded-full blur-[110px] pointer-events-none"></div>

      {/* Cyber Subtle Grid Lines Background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(rgba(56, 189, 248, 0.2) 1px, transparent 1px)`,
          backgroundSize: '28px 28px'
        }}
      ></div>

      {/* Main Glassmorphism Login Card */}
      <div className="relative z-10 w-full max-w-md bg-slate-900/80 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-cyan-500/10 hover:border-slate-700/80 transition-all duration-300">
        
        {/* Shield Emblem / Logo Header */}
        <div className="flex flex-col items-center text-center space-y-3 mb-8">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative bg-slate-950 p-4 rounded-2xl border border-cyan-500/30 text-cyan-400 shadow-inner">
              <svg className="w-10 h-10 transform group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono flex items-center justify-center gap-2">
              CEMS <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/80">AUTHENTICATION</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Cyber Crime Evidence Management System
            </p>
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-start gap-3 animate-in fade-in duration-200">
            <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-bold text-rose-200">Authentication Error</p>
              <p className="mt-0.5 font-normal">{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Username Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Officer Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username (e.g. investigator_khordha)"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-950/70 text-slate-100 placeholder-slate-500 rounded-xl border border-slate-700/80 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all text-sm font-medium"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Access Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter secure password"
                required
                className="w-full pl-10 pr-12 py-3 bg-slate-950/70 text-slate-100 placeholder-slate-500 rounded-xl border border-slate-700/80 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all text-sm font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.05 10.05 0 012.122-.163c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-5.416-5.416a3 3 0 11-4.243-4.243m4.243 4.243L3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-bold tracking-wide rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border border-cyan-400/30"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>VERIFYING CREDENTIALS...</span>
              </>
            ) : (
              <>
                <span>SIGN IN TO CEMS PORTAL</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Fill Section */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Quick Demo Fill
            </span>
            <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 font-mono">
              All 30 Odisha Districts
            </span>
          </div>

          {/* Admin & Popular Quick Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillQuickUser("admin", "Demo@123")}
              className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 text-cyan-300 text-xs font-mono font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm hover:border-cyan-500/50"
            >
              <span>🔑</span>
              <span>Admin (All Districts)</span>
            </button>
            <button
              type="button"
              onClick={() => handleDistrictSelect("Khordha")}
              className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 text-blue-300 text-xs font-mono font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm hover:border-blue-500/50"
            >
              <span>🔍</span>
              <span>Khordha Demo</span>
            </button>
          </div>

          {/* All 30 Odisha Districts Dropdown Selector */}
          <div className="pt-1">
            <label className="block text-[11px] font-semibold text-slate-400 text-left mb-1.5">
              Select District Investigator (All 30 Districts):
            </label>
            <select
              value={selectedDemoDistrict}
              onChange={(e) => handleDistrictSelect(e.target.value)}
              className="w-full bg-slate-950/80 text-slate-200 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all cursor-pointer"
            >
              <option value="">-- Choose Any Odisha District --</option>
              {ODISHA_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  Investigator ({d})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
