"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaVideo,
  FaVideoSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaCog,
  FaTrash,
  FaChartBar,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

const API_BASE =
  process.env.NEXT_PUBLIC_ENDPOINT ||
  process.env.ENDPOINT ||
  "http://localhost:8000";

export default function DashboardPage() {
  const router = useRouter();

  // Tab state
  const [activeTab, setActiveTab] = useState("interview"); // "interview" | "sessions"

  // User
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Interview tab
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  // Sessions tab
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState("");

  // ── Load user profile ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("userProfile");
    if (!raw) { setIsLoading(false); return; }
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.userid) setUserId(parsed.userid);
      if (parsed?.name) setName(parsed.name);
      if (parsed?.email) setEmail(parsed.email);
    } catch { /* ignore */ }

    const storedEmail = (() => {
      try { return JSON.parse(raw)?.email || ""; } catch { return ""; }
    })();

    if (!storedEmail) { setIsLoading(false); return; }

    fetch(`${API_BASE}/users/profile?email=${encodeURIComponent(storedEmail)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        if (data.userid) {
          setUserId(data.userid);
          const stored = localStorage.getItem("userProfile");
          const current = stored ? JSON.parse(stored) : {};
          localStorage.setItem("userProfile", JSON.stringify({ ...current, userid: data.userid }));
        }
        if (data.name) setName(data.name);
        if (data.email) setEmail(data.email);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // ── Camera / mic ───────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!isMounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsCamOn(true);
        setIsMicOn(true);
      } catch {
        if (!isMounted) return;
        setCameraError("Camera or microphone access was blocked.");
      }
    };
    if (typeof navigator !== "undefined" && navigator.mediaDevices) startMedia();
    else setCameraError("Camera preview is not supported in this browser.");
    return () => {
      isMounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Load sessions when tab switches to sessions ────────────────────────
  useEffect(() => {
    if (activeTab === "sessions" && userId && sessions.length === 0 && !sessionsLoading) {
      fetchSessions(userId);
    }
  }, [activeTab, userId]);

  const fetchSessions = async (uid) => {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const res = await fetch(`${API_BASE}/sessions/list?userid=${encodeURIComponent(uid)}`);
      if (!res.ok) throw new Error("Failed to load sessions.");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setSessionsError(err.message || "Failed to load sessions.");
    } finally {
      setSessionsLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const initial = useMemo(() => {
    const t = name.trim();
    return t ? t[0].toUpperCase() : "?";
  }, [name]);

  const handleLogout = () => {
    if (typeof window !== "undefined") localStorage.removeItem("userProfile");
    window.location.href = "/login";
  };

  const toggleMic = () => {
    if (!streamRef.current) return;
    const tracks = streamRef.current.getAudioTracks();
    if (!tracks.length) return;
    const next = !isMicOn;
    tracks.forEach((t) => { t.enabled = next; });
    setIsMicOn(next);
  };

  const toggleCam = () => {
    if (!streamRef.current) return;
    const tracks = streamRef.current.getVideoTracks();
    if (!tracks.length) return;
    const next = !isCamOn;
    tracks.forEach((t) => { t.enabled = next; });
    setIsCamOn(next);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploadStatus("");
    if (!resumeFile) { setUploadStatus("Please select a PDF resume."); return; }
    if (!selectedRole) { setUploadStatus("Please select a role."); return; }
    if (!userId && !email) { setUploadStatus("User ID not found. Please log in again."); return; }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("selected_role", selectedRole);
      if (userId) formData.append("userid", userId);
      if (email) formData.append("email", email);

      const response = await fetch(`${API_BASE}/resume/upload`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) { setUploadStatus(data?.detail || "Upload failed."); return; }

      if (typeof window !== "undefined") {
        const sessionPrefix = data?.session_prefix || "";
        const parts = sessionPrefix.split("/").filter(Boolean);
        localStorage.setItem("interviewSession", JSON.stringify({
          userid: data?.userid || userId,
          sessionid: parts[1] || "",
          session_prefix: sessionPrefix,
        }));
      }

      setResumeFile(null);
      setSelectedRole("");
      setIsUploadOpen(false);
      router.push("/Interview");
    } catch {
      setUploadStatus("Unable to upload resume.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (sessionid) => {
    setIsDeleting(true);
    setDeleteStatus("");
    try {
      const res = await fetch(`${API_BASE}/sessions/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid: userId, sessionid }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.detail || "Delete failed.");
      }
      setSessions((prev) => prev.filter((s) => s.sessionid !== sessionid));
      setDeleteConfirm(null);
    } catch (err) {
      setDeleteStatus(err.message || "Delete failed.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewInsights = (sessionid) => {
    if (typeof window !== "undefined") {
      // Key must be "insightsSession" — that is what insights/page.js reads
      localStorage.setItem("insightsSession", JSON.stringify({ userid: userId, sessionid }));
    }
    router.push(`/insights?userid=${encodeURIComponent(userId)}&sessionid=${encodeURIComponent(sessionid)}`);
  };

  // Parse session ID "YYYYMMDDHHMMSS" into a Date when created_at is missing
  const parseDateFromSessionId = (sid) => {
    if (!sid || sid.length < 14) return null;
    const s = sid.replace(/\D/g, "");
    if (s.length < 14) return null;
    const iso = `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}Z`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDate = (iso, sessionid) => {
    const d = iso ? new Date(iso) : parseDateFromSessionId(sessionid);
    if (!d || isNaN(d.getTime())) return "—";
    try {
      return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
    } catch { return iso || sessionid || "—"; }
  };

  const formatTime = (iso, sessionid) => {
    const d = iso ? new Date(iso) : parseDateFromSessionId(sessionid);
    if (!d || isNaN(d.getTime())) return "";
    try {
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  const scoreColor = (s) => {
    if (s == null) return "text-gray-400";
    if (s >= 70) return "text-emerald-600";
    if (s >= 40) return "text-amber-600";
    return "text-red-600";
  };

  const scoreBg = (s) => {
    if (s == null) return "bg-gray-100 border-gray-200";
    if (s >= 70) return "bg-emerald-50 border-emerald-200";
    if (s >= 40) return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-6 py-4 md:px-10">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-[0.3em] text-gray-900">
            WEBSITE NAME
          </span>
          <div className="flex items-center gap-3">
            {/* Name + email */}
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">{name || "—"}</span>
              <span className="text-xs text-gray-400 truncate max-w-[160px]">{email || "—"}</span>
            </div>
            {/* Avatar + logout dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white hover:opacity-80 transition"
              >
                {initial}
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                  {/* Show name+email on mobile where the inline version is hidden */}
                  <div className="sm:hidden px-2 pb-2 mb-1 border-b border-gray-100">
                    <p className="truncate text-sm font-semibold text-gray-900">{name || "—"}</p>
                    <p className="truncate text-xs text-gray-400">{email || "—"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div className="flex justify-center py-4">
          <div className="relative flex items-center rounded-xl bg-gray-100 p-1">
            {/* Sliding pill */}
            <span
              className="pointer-events-none absolute top-1 left-1 h-[calc(100%-8px)] rounded-[9px] border border-gray-200 bg-white transition-all duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{
                width: "calc(50% - 2px)",
                transform:
                  activeTab === "sessions"
                    ? "translateX(calc(100% + 4px))"
                    : "translateX(0)",
              }}
            />
            {[
              { key: "interview", label: "Interview" },
              { key: "sessions", label: "Sessions" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative z-10 w-32 rounded-[9px] py-2 text-sm font-semibold transition-colors duration-250 ${
                  activeTab === tab.key
                    ? "text-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
      </div>

      {/* ── Content ── */}
      <main className="px-6 py-10 md:px-10">

        {/* ════ INTERVIEW TAB ════ */}
        {activeTab === "interview" && (
          <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
                  AI Interview
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-gray-900">
                  Camera check before you start.
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  Run a quick video and audio test, then begin the interview flow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="self-start rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:opacity-90 lg:self-auto"
              >
                Start Interview
              </button>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              {/* Camera preview */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Test camera and mic</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <FaCog /> Settings
                  </div>
                </div>
                <div className="relative mt-4 h-80 overflow-hidden rounded-xl border border-dashed border-gray-300 bg-black">
                  {cameraError ? (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-400">
                      {cameraError}
                    </div>
                  ) : (
                    <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                  )}
                  {!cameraError && !isCamOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-white">
                      Camera off
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      isMicOn
                        ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        : "border-red-200 bg-red-50 text-red-600"
                    }`}
                  >
                    {isMicOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
                    {isMicOn ? "Mic on" : "Muted"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleCam}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      isCamOn
                        ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        : "border-red-200 bg-red-50 text-red-600"
                    }`}
                  >
                    {isCamOn ? <FaVideo /> : <FaVideoSlash />}
                    {isCamOn ? "Camera on" : "Cam off"}
                  </button>
                </div>
              </div>

              {/* Steps */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">Steps</h3>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    Setup
                  </span>
                </div>
                <div className="mt-5 grid gap-3">
                  {["Upload resume", "Select role", "Interview discussion"].map(
                    (step, i) => (
                      <div
                        key={step}
                        className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-800">{step}</span>
                        </div>
                        <span className="text-xs text-gray-400">Ready</span>
                      </div>
                    )
                  )}
                </div>
                <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-500">Rules</p>
                  <ul className="mt-3 space-y-1.5 text-xs text-red-700">
                    <li>Keep camera and mic enabled during the interview.</li>
                    <li>Answer within the allotted time per question.</li>
                    <li>No external assistance while responding.</li>
                    <li>Use a quiet, well-lit environment.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ════ SESSIONS TAB ════ */}
        {activeTab === "sessions" && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">History</p>
              <h1 className="mt-1.5 text-2xl font-semibold text-gray-900">Interview Sessions</h1>
              <p className="mt-1 text-sm text-gray-500">
                Review past sessions, view insights, and manage your history.
              </p>
            </div>

            {/* Stats */}
            {!sessionsLoading && !sessionsError && sessions.length > 0 && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Total", value: sessions.length, icon: <FaClock className="text-gray-400" /> },
                  { label: "Completed", value: sessions.filter((s) => s.has_insights).length, icon: <FaCheckCircle className="text-emerald-500" /> },
                  {
                    label: "Avg Score",
                    value: (() => {
                      const sc = sessions.filter((s) => s.final_score != null);
                      if (!sc.length) return "—";
                      return Math.round(sc.reduce((a, s) => a + s.final_score, 0) / sc.length) + "%";
                    })(),
                    icon: <FaChartBar className="text-blue-500" />,
                  },
                  {
                    label: "Best Score",
                    value: (() => {
                      const sc = sessions.filter((s) => s.final_score != null);
                      if (!sc.length) return "—";
                      return Math.max(...sc.map((s) => s.final_score)) + "%";
                    })(),
                    icon: <FaCheckCircle className="text-amber-500" />,
                  },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{stat.label}</p>
                      {stat.icon}
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-gray-900">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* List */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">All Sessions</h2>
                {!sessionsLoading && userId && (
                  <button
                    type="button"
                    onClick={() => fetchSessions(userId)}
                    className="text-xs font-semibold text-gray-400 transition hover:text-gray-700"
                  >
                    Refresh
                  </button>
                )}
              </div>

              {sessionsLoading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
                </div>
              ) : sessionsError ? (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                  <FaTimesCircle className="text-3xl text-red-400" />
                  <p className="text-sm font-semibold text-red-600">{sessionsError}</p>
                  <button
                    type="button"
                    onClick={() => fetchSessions(userId)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Retry
                  </button>
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                  <FaClock className="text-4xl text-gray-200" />
                  <p className="text-sm font-semibold text-gray-500">No sessions yet</p>
                  <p className="text-xs text-gray-400">Start your first interview from the Interview tab.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("interview")}
                    className="mt-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Go to Interview
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {sessions.map((session, idx) => (
                    <div
                      key={session.sessionid}
                      className="flex flex-col gap-4 px-6 py-5 transition hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {session.role || "Interview Session"}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <FaClock />
                              {formatDate(session.created_at, session.sessionid)} · {formatTime(session.created_at, session.sessionid)}
                            </span>
                            {session.knowledge_level && (
                              <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium capitalize text-gray-500">
                                {session.knowledge_level}
                              </span>
                            )}
                          </div>
                          {session.has_insights && session.overall_feedback && (
                            <p className="mt-1.5 max-w-md text-xs text-gray-400 line-clamp-2">
                              {session.overall_feedback}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-2 sm:ml-4">
                        {session.has_insights && session.final_score != null ? (
                          <div className={`rounded-xl border px-3 py-1.5 text-center ${scoreBg(session.final_score)}`}>
                            <p className={`text-lg font-bold leading-none ${scoreColor(session.final_score)}`}>
                              {session.final_score}%
                            </p>
                            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400">
                              Score
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-center">
                            <p className="text-sm font-semibold leading-none text-gray-300">—</p>
                            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-gray-300">Score</p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => session.has_insights && handleViewInsights(session.sessionid)}
                          disabled={!session.has_insights}
                          title={session.has_insights ? "View insights" : "Complete an interview to see insights"}
                          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            session.has_insights
                              ? "bg-gray-900 text-white hover:opacity-80 cursor-pointer"
                              : "cursor-not-allowed border border-gray-200 bg-gray-50 text-gray-300"
                          }`}
                        >
                          <FaChartBar className="text-xs" />
                          Insights
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(session.sessionid)}
                          className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-100"
                        >
                          <FaTrash className="text-xs" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Upload modal ── */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Start interview setup</h3>
              <button
                type="button"
                onClick={() => { setIsUploadOpen(false); setUploadStatus(""); }}
                className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-500 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <form className="mt-5 space-y-4" onSubmit={handleUpload}>
              <div>
                <label className="text-sm font-semibold text-gray-700">Upload resume (PDF)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Select role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-sm"
                >
                  <option value="" disabled>Choose a role</option>
                  <option value="AI/ML Engineer">AI/ML Engineer</option>
                  <option value="Data Analyst">Data Analyst</option>
                </select>
              </div>
              {uploadStatus && <p className="text-sm text-gray-500">{uploadStatus}</p>}
              <button
                type="submit"
                disabled={isUploading}
                className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {isUploading ? "Uploading..." : "Upload & Continue"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Uploading overlay ── */}
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
            <p className="text-sm font-semibold text-gray-900">Preparing your interview...</p>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <FaTrash className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Delete session?</h3>
                <p className="text-xs text-gray-400">This cannot be undone.</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              All conversation data, insights, and files will be permanently removed.
            </p>
            {deleteStatus && <p className="mt-3 text-sm font-medium text-red-600">{deleteStatus}</p>}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setDeleteConfirm(null); setDeleteStatus(""); }}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}