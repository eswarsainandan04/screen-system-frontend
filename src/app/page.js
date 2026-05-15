"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/* ─── Animated counter ──────────────────────────────────────────────────── */
function Counter({ target, suffix = "" }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      let start = 0;
      const step = Math.ceil(target / 60);
      const id = setInterval(() => {
        start = Math.min(start + step, target);
        setVal(start);
        if (start >= target) clearInterval(id);
      }, 18);
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ─── Floating word chip ────────────────────────────────────────────────── */
function Chip({ text, style }) {
  return (
    <span
      className="absolute rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wide text-white/40 backdrop-blur-sm"
      style={style}
    >
      {text}
    </span>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const glowX = mousePos.x;
  const glowY = mousePos.y;

  const features = [
    {
      icon: "◈",
      title: "Resume Intelligence",
      desc: "Parses your CV and builds a personalised question bank from your actual experience.",
    },
    {
      icon: "◎",
      title: "Adaptive Questioning",
      desc: "Real-time difficulty scaling based on your answers — never too easy, never unfair.",
    },
    {
      icon: "◉",
      title: "Instant Analysis",
      desc: "Score, per-question feedback, ideal answers, and improvement areas saved the moment the session ends.",
    },
    {
      icon: "◐",
      title: "Session History",
      desc: "All past interviews stored. Track progress, compare scores, and revisit feedback anytime.",
    },
  ];

  const chips = [
    { text: "NLP Processing", style: { top: "12%", left: "8%" } },
    { text: "RAG Retrieval", style: { top: "22%", right: "10%" } },
    { text: "Vector Search", style: { top: "60%", left: "5%" } },
    { text: "Speech-to-Text", style: { bottom: "28%", right: "7%" } },
    { text: "LLM Evaluation", style: { bottom: "15%", left: "12%" } },
    { text: "Real-time TTS", style: { top: "42%", right: "4%" } },
  ];

  return (
    <main
      className="relative min-h-screen overflow-x-hidden bg-[#080808] text-white"
      style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}
    >
      {/* ── Google font ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: .4; }
          100% { transform: scale(1.9); opacity: 0;  }
        }
        @keyframes scan {
          0%   { top: 0; }
          100% { top: 100%; }
        }
        @keyframes blink {
          0%,100% { opacity: 1; } 50% { opacity: 0; }
        }
        .fade-up   { animation: fadeUp  .7s ease both; }
        .fade-in   { animation: fadeIn  .6s ease both; }
        .delay-1   { animation-delay: .12s; }
        .delay-2   { animation-delay: .24s; }
        .delay-3   { animation-delay: .38s; }
        .delay-4   { animation-delay: .52s; }
        .card-hover {
          transition: transform .25s ease, border-color .25s ease, background .25s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          border-color: rgba(255,255,255,.18);
          background: rgba(255,255,255,.055);
        }
      `}</style>

      {/* ── Cursor glow ── */}
      <div
        className="pointer-events-none fixed z-0 rounded-full"
        style={{
          width: 520,
          height: 520,
          left: glowX - 260,
          top: glowY - 260,
          background: "radial-gradient(circle, rgba(99,102,241,.09) 0%, transparent 70%)",
          transition: "left .08s linear, top .08s linear",
        }}
      />

      {/* ── Fine grid ── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* NAVBAR */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <nav className="relative z-20 flex items-center justify-between border-b border-white/[.06] px-8 py-4 md:px-14">
        <div className="flex items-center gap-2.5">

          <span className="text-sm font-semibold tracking-[.12em] text-white/80 uppercase">
            WEBSITE NAME
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/login")}
            className="rounded-lg px-4 py-1.5 text-sm font-medium text-white/60 transition hover:text-white"
          >
            Sign in
          </button>
          <button
            onClick={() => router.push("/signup")}
            className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Get started
          </button>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* HERO */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex min-h-[88vh] flex-col items-center justify-center overflow-hidden px-6 text-center">

        {/* Floating tech chips */}
        {chips.map((c, i) => <Chip key={i} {...c} />)}

        {/* Pulse rings behind the badge */}
        <div className="relative mb-8">
          {[1, 2].map((n) => (
            <span
              key={n}
              className="absolute inset-0 rounded-full ring-1 ring-indigo-400/30"
              style={{
                animation: `pulse-ring 2.4s ease-out ${n * .7}s infinite`,
              }}
            />
          ))}
          <span className="relative rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-[11px] font-medium tracking-[.18em] text-indigo-300 uppercase fade-in">
            AI-powered screening
          </span>
        </div>

        {/* Headline */}
        <h1
          className="fade-up delay-1 max-w-3xl text-5xl font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-6xl lg:text-7xl"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Interview smarter.
          <br />
          <span className="text-white/30">Get hired faster.</span>
        </h1>

        <p className="fade-up delay-2 mt-6 max-w-xl text-base leading-relaxed text-white/45">
          Upload your resume, choose a role, and face a live AI interviewer that
          adapts to your knowledge level — then get detailed feedback the moment
          you finish.
        </p>

        {/* CTAs */}
        <div className="fade-up delay-3 mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => router.push("/signup")}
            className="group relative overflow-hidden rounded-xl bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-white/92"
          >
            <span className="relative z-10">Start your interview →</span>
          </button>
          <button
            onClick={() => router.push("/login")}
            className="rounded-xl border border-white/12 px-7 py-3 text-sm font-medium text-white/60 transition hover:border-white/25 hover:text-white"
          >
            Sign in
          </button>
        </div>

        {/* Stats row */}
        <div className="fade-up delay-4 mt-16 flex flex-wrap items-center justify-center gap-10 border-t border-white/[.06] pt-10">
          {[
            { target: 20, suffix: " min", label: "per session" },
            { target: 100, suffix: "%", label: "personalised questions" },
            { target: 3, suffix: "s", label: "insight generation" },
          ].map(({ target, suffix, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span
                className="text-3xl font-bold tracking-tight text-white"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                <Counter target={target} suffix={suffix} />
              </span>
              <span className="text-xs text-white/35 tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MOCK INTERVIEW CARD */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex justify-center px-6 pb-20">
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.03] backdrop-blur-sm">
          {/* Window chrome */}
          <div className="flex items-center gap-2 border-b border-white/[.06] px-4 py-3">
            {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
              <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
            ))}
            <span className="ml-3 text-[11px] text-white/25 tracking-wide" style={{ fontFamily: "'DM Mono', monospace" }}>
              ai-interview-room · live
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animation: "blink 1.4s ease infinite" }} />
              Recording
            </span>
          </div>

          {/* Chat bubbles */}
          <div className="flex flex-col gap-4 p-6">
            {[
              {
                role: "AI",
                bg: "bg-white/[.06]",
                align: "items-start",
                msg: "Can you walk me through how gradient descent works, and why we use mini-batches instead of the full dataset?",
              },
              {
                role: "You",
                bg: "bg-indigo-500/15 border border-indigo-500/25",
                align: "items-end",
                msg: "Sure — gradient descent minimises the loss by moving in the direction of steepest descent. Mini-batches give us a noisy but faster estimate of the true gradient…",
                typing: false,
              },
            ].map(({ role, bg, align, msg, typing }) => (
              <div key={role} className={`flex flex-col gap-1.5 ${align}`}>
                <span className="text-[10px] font-medium uppercase tracking-widest text-white/30">{role}</span>
                <div className={`max-w-lg rounded-2xl px-4 py-3 text-sm leading-relaxed text-white/80 ${bg}`}>
                  {msg}
                  {typing && (
                    <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-indigo-300" />
                  )}
                </div>
              </div>
            ))}

            {/* Score preview */}
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.03] px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                <span className="text-sm font-bold text-emerald-400">8</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-white/70">Answer scored</p>
                <p className="mt-0.5 text-[11px] text-white/35">
                  Good depth. Mention momentum-based optimisers for a stronger answer.
                </p>
              </div>
              <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                Correct
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* FEATURES */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 pb-24 md:px-14">
        <div className="mx-auto max-w-5xl">
          <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-[.2em] text-white/30">
            How it works
          </p>
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-white md:text-4xl">
            Everything you need to ace it
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon, title, desc }, i) => (
              <div
                key={title}
                className="card-hover rounded-2xl border border-white/[.07] bg-white/[.03] p-6"
              >
                <span className="mb-4 block text-2xl text-indigo-300/80">{icon}</span>
                <h3 className="mb-2 text-sm font-semibold text-white/90">{title}</h3>
                <p className="text-xs leading-relaxed text-white/40">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* HOW IT WORKS — steps */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 pb-28 md:px-14">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-[.2em] text-white/30">
            3 steps
          </p>
          <h2 className="mb-14 text-center text-3xl font-bold tracking-tight text-white md:text-4xl">
            From upload to offer
          </h2>
          <div className="relative flex flex-col gap-0">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-5 bottom-5 w-px bg-white/[.06]" />
            {[
              {
                n: "01",
                title: "Upload & configure",
                body: "Drop your PDF resume, pick your target role (AI/ML Engineer, Data Analyst, …), and we handle the rest.",
              },
              {
                n: "02",
                title: "Live AI interview",
                body: "Speak your answers aloud. The AI asks follow-ups, adapts difficulty, and keeps you on track within 20 minutes.",
              },
              {
                n: "03",
                title: "Instant report",
                body: "Score, per-question breakdown, strengths, and exactly what to improve — stored permanently in your dashboard.",
              },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-8 pb-12 last:pb-0">
                <div className="relative shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[.1] bg-[#080808]">
                    <span
                      className="text-[11px] font-bold text-white/40"
                      style={{ fontFamily: "'DM Mono', monospace" }}
                    >
                      {n}
                    </span>
                  </div>
                </div>
                <div className="pt-2">
                  <h3 className="mb-1.5 text-base font-semibold text-white/90">{title}</h3>
                  <p className="text-sm leading-relaxed text-white/40">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CTA BANNER */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 pb-24 md:px-14">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/[.08] bg-white/[.03] px-8 py-14 text-center md:px-16">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl" />
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[.2em] text-indigo-400/80">
            Ready when you are
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Your next interview is a click away
          </h2>
          <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-white/40">
            Free to start. No credit card. Get a full AI interview session with
            detailed feedback in under 25 minutes.
          </p>
          <button
            onClick={() => router.push("/signup")}
            className="rounded-xl bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Create free account →
          </button>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* FOOTER */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[.05] px-8 py-8 md:px-14">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-xs font-semibold tracking-[.14em] text-white/20 uppercase">
            PGAGI · AI Screening System
          </span>
          <span className="text-xs text-white/20">
            Built with Next.js · Groq · Supabase
          </span>
        </div>
      </footer>
    </main>
  );
}