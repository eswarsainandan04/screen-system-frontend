"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_ENDPOINT ||
  process.env.ENDPOINT ||
  "http://localhost:8000";

// ── Helpers ──────────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (score / 100);
  const color =
    score >= 75 ? "#22d3ee" : score >= 50 ? "#facc15" : "#f87171";
  const label =
    score >= 75 ? "Excellent" : score >= 50 ? "Good" : score >= 30 ? "Needs Work" : "Poor";

  return (
    <div className="relative flex flex-col items-center justify-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle
          cx="70" cy="70" r={radius}
          fill="none" stroke="#1f2937" strokeWidth="12"
        />
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        <text x="70" y="66" textAnchor="middle" fill="white" fontSize="28" fontWeight="700" fontFamily="monospace">
          {score}
        </text>
        <text x="70" y="84" textAnchor="middle" fill="#9ca3af" fontSize="11">
          out of 100
        </text>
      </svg>
      <span
        className="rounded-full px-3 py-1 text-xs font-semibold"
        style={{ color, border: `1px solid ${color}33`, background: `${color}15` }}
      >
        {label}
      </span>
    </div>
  );
}

function StatCard({ label, value, sub, color = "text-white" }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-gray-700/60 bg-gray-800/60 px-6 py-5">
      <span className="text-xs font-medium uppercase tracking-widest text-gray-500">{label}</span>
      <span className={`text-3xl font-bold font-mono ${color}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

function QuestionCard({ ev, index }) {
  const [open, setOpen] = useState(false);
  const score = ev.score ?? 0;
  const correct = ev.correct ?? false;
  const barColor = score >= 7 ? "bg-cyan-400" : score >= 4 ? "bg-yellow-400" : "bg-red-400";
  const badgeColor = correct
    ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
    : "text-red-400 border-red-500/40 bg-red-500/10";

  return (
    <div className="rounded-2xl border border-gray-700/60 bg-gray-800/50 overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-700/30 transition"
      >
        {/* Index */}
        <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-300">
          Q{index}
        </span>

        {/* Question preview */}
        <span className="flex-1 text-sm text-gray-200 line-clamp-1 font-medium">
          {ev.question}
        </span>

        {/* Score bar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 rounded-full bg-gray-700 overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score * 10}%` }} />
          </div>
          <span className="text-xs font-mono text-gray-400">{score}/10</span>
        </div>

        {/* Badge */}
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeColor}`}>
          {correct ? "Correct" : "Incorrect"}
        </span>

        {/* Chevron */}
        <svg
          className={`shrink-0 h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-gray-700/60 px-5 py-4 flex flex-col gap-4 text-sm">
          {/* Candidate answer */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">Candidate Answer</p>
            <p className="text-gray-300 leading-relaxed bg-gray-900/60 rounded-xl px-4 py-3">
              {ev.answer || <span className="italic text-gray-500">No answer provided</span>}
            </p>
          </div>

          {/* Feedback */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">Feedback</p>
            <p className="text-gray-300 leading-relaxed">{ev.feedback}</p>
          </div>

          {/* Ideal answer hint */}
          {ev.ideal_answer_hint && (
            <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/8 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500 mb-1">Ideal Answer Hint</p>
              <p className="text-cyan-200/80 text-sm leading-relaxed">{ev.ideal_answer_hint}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const router = useRouter();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    // Read userid/sessionid from URL params first (navigation from dashboard),
    // fall back to localStorage (page refresh / direct open)
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    const urlUserid = params.get("userid");
    const urlSessionid = params.get("sessionid");

    let sid;
    if (urlUserid && urlSessionid) {
      sid = { userid: urlUserid, sessionid: urlSessionid };
      // Keep localStorage in sync for refreshes
      localStorage.setItem("insightsSession", JSON.stringify(sid));
    } else {
      const raw = localStorage.getItem("insightsSession");
      if (!raw) {
        setFetchError("No interview session found. Please complete an interview first.");
        setLoading(false);
        return;
      }
      try { sid = JSON.parse(raw); } catch {
        setFetchError("Invalid session data.");
        setLoading(false);
        return;
      }
    }

    const fetchInsights = async () => {
      try {
        // ── Step 1: Try reading analysis.json directly (fast, no LLM) ──
        const res = await fetch(
          `${API_BASE}/insights/analysis?userid=${encodeURIComponent(sid.userid)}&sessionid=${encodeURIComponent(sid.sessionid)}`
        );

        if (res.ok) {
          const data = await res.json();
          setInsights(data);
          setLoading(false);
          return;
        }

        // ── Step 2: analysis.json missing → trigger generation once ──────
        if (res.status === 404) {
          const genRes = await fetch(`${API_BASE}/insights/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userid: sid.userid, sessionid: sid.sessionid }),
          });
          if (!genRes.ok) {
            const err = await genRes.json().catch(() => ({}));
            throw new Error(err?.detail || "Failed to generate insights.");
          }
          // Generation succeeded — now read analysis.json
          const analysisRes = await fetch(
            `${API_BASE}/insights/analysis?userid=${encodeURIComponent(sid.userid)}&sessionid=${encodeURIComponent(sid.sessionid)}`
          );
          if (analysisRes.ok) {
            const data = await analysisRes.json();
            setInsights(data);
            setLoading(false);
            return;
          }
          // Fall back to the generate response body itself
          const genData = await genRes.json().catch(() => null);
          if (genData) { setInsights(genData); setLoading(false); return; }
        }

        throw new Error("Unable to load insights. Please try again.");
      } catch (e) {
        setFetchError(e.message || "Something went wrong.");
        setLoading(false);
      }
    };

    fetchInsights();
  }, []);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white gap-6 px-6">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
          <svg className="animate-spin h-10 w-10 text-purple-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">Analysing your interview…</p>
          <p className="mt-1 text-sm text-gray-500">Groq is evaluating every answer. This takes a moment.</p>
        </div>
      </main>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white gap-6 px-6">
        <div className="w-full max-w-md rounded-2xl border border-red-700/40 bg-red-900/20 p-8 text-center">
          <p className="text-lg font-semibold text-red-300">Could not load insights</p>
          <p className="mt-2 text-sm text-gray-400">{fetchError}</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-lg bg-gray-800 border border-gray-700 px-5 py-2 text-sm text-white hover:bg-gray-700 transition"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  const score = insights?.final_score ?? 0;
  const totalQ = insights?.total_questions ?? 0;
  const correctQ = insights?.correct_answers ?? 0;
  const evaluations = insights?.evaluations ?? [];
  const strengths = insights?.strengths ?? [];
  const improvements = insights?.improvement_areas ?? [];
  const overallFeedback = insights?.overall_feedback ?? "";

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm px-6">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          <span className="text-sm font-semibold">Interview Results</span>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 transition"
        >
          Back to dashboard
        </button>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 flex flex-col gap-8">

        {/* ── HERO: Score + stats ── */}
        <section className="rounded-3xl border border-gray-700/60 bg-gradient-to-br from-gray-900 via-gray-900 to-purple-950/30 p-8">
          <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-gray-500">Overall Performance</p>
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <ScoreRing score={score} />
            <div className="grid grid-cols-2 gap-4 flex-1 w-full">
              <StatCard label="Total Questions" value={totalQ} />
              <StatCard
                label="Correct Answers"
                value={correctQ}
                sub={`${totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0}% accuracy`}
                color="text-emerald-400"
              />
              <StatCard
                label="Incorrect"
                value={totalQ - correctQ}
                color="text-red-400"
              />
              <StatCard
                label="Avg Score / Q"
                value={totalQ > 0 ? (evaluations.reduce((s, e) => s + (e.score ?? 0), 0) / totalQ).toFixed(1) : "—"}
                sub="out of 10"
                color="text-cyan-400"
              />
            </div>
          </div>

          {/* Overall feedback */}
          {overallFeedback && (
            <div className="mt-6 rounded-2xl border border-gray-700/60 bg-gray-800/50 px-5 py-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">Interviewer Summary</p>
              <p className="text-sm text-gray-300 leading-relaxed">{overallFeedback}</p>
            </div>
          )}
        </section>

        {/* ── STRENGTHS + IMPROVEMENTS ── */}
        <section className="grid sm:grid-cols-2 gap-4">
          {/* Strengths */}
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-6 py-5 flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Strengths</p>
            {strengths.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="mt-0.5 shrink-0 h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                      <svg className="h-2.5 w-2.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No strengths recorded.</p>
            )}
          </div>

          {/* Improvements */}
          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/5 px-6 py-5 flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">Areas to Improve</p>
            {improvements.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="mt-0.5 shrink-0 h-4 w-4 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
                      <svg className="h-2.5 w-2.5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 9v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No specific areas noted.</p>
            )}
          </div>
        </section>

        {/* ── PER-QUESTION BREAKDOWN ── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Question-by-Question Breakdown
            </p>
            <span className="text-xs text-gray-500">{evaluations.length} question{evaluations.length !== 1 ? "s" : ""}</span>
          </div>

          {evaluations.length > 0 ? (
            evaluations.map((ev, i) => (
              <QuestionCard key={i} ev={ev} index={i + 1} />
            ))
          ) : (
            <div className="rounded-2xl border border-gray-700/60 bg-gray-800/40 px-6 py-8 text-center text-sm text-gray-500 italic">
              No question evaluations available.
            </div>
          )}
        </section>

        {/* ── CTA ── */}
        <section className="flex flex-col sm:flex-row gap-3 pt-2 pb-12">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("insightsSession");
              localStorage.removeItem("interviewSession");
              router.push("/dashboard");
            }}
            className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-3 text-sm font-semibold text-white transition shadow-[0_0_20px_rgba(147,51,234,0.3)]"
          >
            Start New Interview
          </button>
        </section>
      </div>
    </main>
  );
}