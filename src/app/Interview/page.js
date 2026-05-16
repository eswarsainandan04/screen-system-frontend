"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPhoneSlash,
} from "react-icons/fa";

const API_BASE = "https://screen-system-backend-production.up.railway.app";
const SILENCE_TIMEOUT_MS = 60000;
const MAX_INTERVIEW_MS = 20 * 60 * 1000; // 20 minutes hard cap

export default function InterviewStatusPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [lastAnswer, setLastAnswer] = useState("");
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [elapsed, setElapsed] = useState("00:00");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);

  const lastSpokenRef = useRef("");
  const hasStartedRef = useRef(false);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const silenceTimerRef = useRef(null);
  const lastSpeechAtRef = useRef(0);
  const manualStopRef = useRef(false);
  const listeningIdRef = useRef(0);
  const callStartRef = useRef(Date.now());
  const sessionEndedRef = useRef(false); // ref so callbacks always see latest value

  const speechRecognitionClass = useMemo(() => {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  // ── Load session from localStorage ──────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("interviewSession");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.userid && parsed?.sessionid) setSession(parsed);
    } catch {}
  }, []);

  // ── Auto-dismiss notices ─────────────────────────────────────────────────
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // ── Elapsed timer + 20-min auto-end ─────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - callStartRef.current) / 1000);
      const m = String(Math.floor(diff / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setElapsed(`${m}:${s}`);
      setElapsedSeconds(diff);

      // Hard 20-minute cap — auto-end if backend hasn't already
      if (diff >= MAX_INTERVIEW_MS / 1000 && !sessionEndedRef.current) {
        sessionEndedRef.current = true;
        setSessionEnded(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Media stream ─────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!isMounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setMicOn(true);
        setCamOn(true);
      } catch {
        if (!isMounted) return;
        setMediaError("Camera or microphone access was blocked.");
        setMicOn(false);
        setCamOn(false);
      }
    };
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      startMedia();
    } else {
      setMediaError("Camera preview is not supported in this browser.");
    }
    return () => {
      isMounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  // ── End session (call backend + redirect to insights) ────────────────────
  const endSession = useCallback(async (sessionData) => {
    if (sessionEndedRef.current && isEndingSession) return;
    sessionEndedRef.current = true;
    setSessionEnded(true);
    setIsEndingSession(true);

    // Stop all media + speech
    window.speechSynthesis?.cancel();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const sid = sessionData || session;
    if (!sid) { router.push("/dashboard"); return; }

    try {
      await fetch(`${API_BASE}/interview/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid: sid.userid, sessionid: sid.sessionid }),
      });
    } catch {
      // Non-fatal — still redirect
    }

    // Store session info for the insights page to use
    localStorage.setItem(
      "insightsSession",
      JSON.stringify({ userid: sid.userid, sessionid: sid.sessionid })
    );
    router.push("/insights");
  }, [session, isEndingSession, router]);

  // ── Transcript helpers ───────────────────────────────────────────────────
  const updateTranscriptSummary = useCallback((items) => {
    const lastAi = [...items].reverse().find((m) => m.sender === "ai");
    const lastUser = [...items].reverse().find((m) => m.sender === "user");
    setLastQuestion(lastAi?.message || "");
    setLastAnswer(lastUser?.message || "");
  }, []);

  // ── Fetch next question from backend ────────────────────────────────────
  const requestNextQuestion = useCallback(
    async (userMessage) => {
      if (!session || sessionEndedRef.current) return;
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/interview/next`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userid: session.userid,
            sessionid: session.sessionid,
            message: userMessage || null,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data?.detail || "Unable to fetch interview question.");
          return;
        }

        // Check if backend signalled session end
        if (data?.session_ended && !sessionEndedRef.current) {
          // Update transcript first so last message is visible
          if (Array.isArray(data?.conversation)) updateTranscriptSummary(data.conversation);
          else if (data?.question) setLastQuestion(data.question);
          // Give time for TTS to speak the closing statement then end
          setTimeout(() => endSession(session), 6000);
          return;
        }

        if (Array.isArray(data?.conversation)) {
          updateTranscriptSummary(data.conversation);
        } else {
          const updated = [];
          if (userMessage) updated.push({ sender: "user", message: userMessage });
          if (data?.question) updated.push({ sender: "ai", message: data.question });
          updateTranscriptSummary(updated);
        }
      } catch {
        setError("Unable to reach the interview service.");
      } finally {
        setIsLoading(false);
      }
    },
    [session, updateTranscriptSummary, endSession]
  );

  // ── Silence timer ────────────────────────────────────────────────────────
  const resetSilenceTimer = useCallback((listenId) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (listeningIdRef.current !== listenId) return;
      if (!recognitionRef.current) return;
      manualStopRef.current = false;
      recognitionRef.current.stop();
    }, SILENCE_TIMEOUT_MS);
  }, []);

  // ── Speech recognition ───────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!speechRecognitionClass) { setError("Speech recognition is not supported in this browser."); return; }
    if (isSpeaking) { setNotice("Wait for the AI to finish speaking."); return; }
    if (isListening || isLoading) return;
    if (!micOn) { setNotice("Microphone must stay on during the interview."); return; }
    if (sessionEndedRef.current) return;

    const recognition = recognitionRef.current || new speechRecognitionClass();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    manualStopRef.current = false;
    const listenId = Date.now();
    listeningIdRef.current = listenId;
    transcriptRef.current = "";
    setTranscriptPreview("");
    lastSpeechAtRef.current = Date.now();
    resetSilenceTimer(listenId);

    recognition.onresult = (event) => {
      if (listeningIdRef.current !== listenId) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) transcriptRef.current += `${r[0].transcript} `;
        else interim += r[0].transcript;
      }
      setTranscriptPreview(`${transcriptRef.current}${interim}`.trim());
      lastSpeechAtRef.current = Date.now();
      resetSilenceTimer(listenId);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setError("Speech recognition error. Please try again.");
    };

    recognition.onend = () => {
      if (listeningIdRef.current !== listenId) return;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const timeSinceSpeech = Date.now() - lastSpeechAtRef.current;
      const finalText = transcriptRef.current.trim();
      if (!manualStopRef.current && timeSinceSpeech < SILENCE_TIMEOUT_MS) {
        try {
          setIsListening(true);
          recognition.start();
          resetSilenceTimer(listenId);
          return;
        } catch {}
      }
      setIsListening(false);
      transcriptRef.current = "";
      setTranscriptPreview("");
      if (finalText) requestNextQuestion(finalText);
      else if (!isLoading) setNotice("No speech detected. Tap to answer again.");
    };

    try { setIsListening(true); recognition.start(); } catch { setIsListening(false); }
  }, [speechRecognitionClass, isListening, isLoading, micOn, isSpeaking, requestNextQuestion, resetSilenceTimer]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      manualStopRef.current = true;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // ── Text-to-Speech ───────────────────────────────────────────────────────
  const speak = useCallback(
    (text) => {
      if (typeof window === "undefined") return;
      if (!("speechSynthesis" in window)) { startListening(); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (!sessionEndedRef.current) startListening();
      };
      window.speechSynthesis.speak(utterance);
    },
    [startListening]
  );

  // ── Bootstrap interview ──────────────────────────────────────────────────
  useEffect(() => {
    if (!session || hasStartedRef.current) return;
    hasStartedRef.current = true;
    requestNextQuestion(null);
  }, [session, requestNextQuestion]);

  // ── Speak new AI questions ───────────────────────────────────────────────
  useEffect(() => {
    if (!lastQuestion || lastSpokenRef.current === lastQuestion) return;
    lastSpokenRef.current = lastQuestion;
    speak(lastQuestion);
  }, [lastQuestion, speak]);

  // ── Auto-end when timer hits 20 min ─────────────────────────────────────
  useEffect(() => {
    if (sessionEnded && session && !isEndingSession) {
      endSession(session);
    }
  }, [sessionEnded, session, isEndingSession, endSession]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const handleToggleMic = () => {
    if (!streamRef.current) return;
    if (micOn) { setNotice("Microphone must stay on during the interview."); return; }
    streamRef.current.getAudioTracks().forEach((t) => { t.enabled = true; });
    setMicOn(true);
  };

  const handleToggleCam = () => {
    if (!streamRef.current) return;
    if (camOn) { setNotice("Camera must stay on during the interview."); return; }
    streamRef.current.getVideoTracks().forEach((t) => { t.enabled = true; });
    setCamOn(true);
  };

  const handleAnswerToggle = () => {
    if (sessionEnded) return;
    if (isSpeaking) { setNotice("Wait for the AI to finish speaking."); return; }
    if (isListening) { stopListening(); return; }
    startListening();
  };

  const handleEndCall = () => {
    if (isEndingSession) return;
    endSession(session);
  };

  // ── Timer color (green → yellow → red) ──────────────────────────────────
  const timerColor =
    elapsedSeconds >= 17 * 60
      ? "text-red-400 border-red-500/50 bg-red-500/10"
      : elapsedSeconds >= 15 * 60
      ? "text-yellow-300 border-yellow-500/50 bg-yellow-500/10"
      : "text-gray-300 border-gray-700 bg-gray-800";

  /* ── No-session fallback ── */
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6">
        <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 p-10 text-center shadow-xl">
          <h1 className="text-xl font-semibold text-white">Interview session not found</h1>
          <p className="mt-3 text-sm text-gray-400">Please upload your resume and start a new interview session.</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  /* ── Ending overlay ── */
  if (isEndingSession) {
    return (
      <main className="flex h-screen flex-col items-center justify-center bg-gray-950 text-white gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-600/20 border border-purple-500/40">
          <svg className="animate-spin h-8 w-8 text-purple-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-white">Generating your interview insights…</p>
        <p className="text-sm text-gray-400">This may take a few seconds. You'll be redirected shortly.</p>
      </main>
    );
  }

  /* ── Status pill ── */
  const statusLabel = isSpeaking ? "AI Speaking" : isListening ? "Listening…" : isLoading ? "Processing…" : "Standby";
  const statusColor = isSpeaking
    ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
    : isListening
    ? "bg-red-500/20 text-red-300 border-red-500/40"
    : "bg-gray-700/50 text-gray-400 border-gray-600/40";

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-gray-950 text-white select-none">

      {/* ── TOP BAR ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-5">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          <span className="text-sm font-semibold text-white">AI Interview Room</span>
          <span className="ml-2 rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400 border border-gray-700">
            Live
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
          {/* Timer — color-coded */}
          <span className={`rounded border px-3 py-1 text-xs font-mono font-semibold transition-colors ${timerColor}`}>
            {elapsed} / 20:00
          </span>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* LEFT PANEL — Transcript */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Transcript</p>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {/* AI message bubble */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold">AI</div>
                <span className="text-xs text-gray-500">Interviewer</span>
              </div>
              <div className="ml-8 rounded-2xl rounded-tl-sm bg-gray-800 px-3.5 py-2.5 text-sm text-gray-200 leading-relaxed">
                {lastQuestion || (
                  <span className="text-gray-500 italic">Preparing first question…</span>
                )}
              </div>
            </div>

            {/* User message bubble */}
            {lastAnswer && (
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">You</span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold">ME</div>
                </div>
                <div className="mr-8 rounded-2xl rounded-tr-sm bg-blue-600/20 border border-blue-500/30 px-3.5 py-2.5 text-sm text-blue-100 leading-relaxed">
                  {lastAnswer}
                </div>
              </div>
            )}

            {/* Live transcript preview */}
            {transcriptPreview && (
              <div className="flex flex-col items-end gap-1.5">
                <div className="mr-8 rounded-2xl rounded-tr-sm border border-dashed border-blue-500/40 bg-blue-500/10 px-3.5 py-2.5 text-sm text-blue-300/80 leading-relaxed italic">
                  {transcriptPreview}
                  <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-blue-400" />
                </div>
              </div>
            )}

            {/* Time warning banner */}
            {elapsedSeconds >= 15 * 60 && elapsedSeconds < 20 * 60 && (
              <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3.5 py-2.5 text-xs text-yellow-300">
                ⏳ {Math.ceil((20 * 60 - elapsedSeconds) / 60)} min remaining — interview wrapping up.
              </div>
            )}
          </div>
        </aside>

        {/* CENTER — Video stage */}
        <div className="relative flex flex-1 flex-col items-center justify-center bg-gray-950 p-6">

          {/* AI avatar card */}
          <div
            className="relative flex w-full max-w-2xl flex-col items-center justify-center rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl"
            style={{ aspectRatio: "16/9" }}
          >
            {isSpeaking && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-teal-400/60 shadow-[0_0_40px_rgba(45,212,191,0.15)]" />
            )}

            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <div className={`absolute inset-0 rounded-full transition-all duration-300 ${isSpeaking ? "ring-4 ring-teal-400/60 scale-110" : "ring-2 ring-gray-700"}`} />
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-700 text-2xl font-bold shadow-lg">
                  AI
                </div>
                {isSpeaking && (
                  <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-end gap-0.5">
                    {[3, 5, 7, 5, 3].map((h, i) => (
                      <span
                        key={i}
                        className="w-1 rounded-full bg-teal-400 animate-pulse"
                        style={{ height: `${h * 2}px`, animationDelay: `${i * 80}ms` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 max-w-lg px-4 text-center">
                <p className="text-base text-gray-200 leading-relaxed">
                  {lastQuestion || (
                    <span className="text-gray-500 italic">Preparing your first question…</span>
                  )}
                </p>
              </div>
            </div>

            <div className="absolute bottom-3 left-4 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full bg-purple-400" />
              <span className="text-xs font-medium text-white">AI Interviewer</span>
            </div>
          </div>

          {/* PiP — User video */}
          <div className="absolute bottom-8 right-8 w-52 overflow-hidden rounded-xl border-2 border-gray-700 bg-gray-900 shadow-xl">
            <div className="relative" style={{ aspectRatio: "4/3" }}>
              {mediaError ? (
                <div className="flex h-full w-full items-center justify-center bg-gray-800 text-center text-xs text-gray-400 p-2">
                  {mediaError}
                </div>
              ) : (
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              )}
              {!camOn && !mediaError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
                  <FaVideoSlash className="text-2xl text-gray-500" />
                </div>
              )}
              <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70">
                {micOn
                  ? <FaMicrophone className="text-[10px] text-green-400" />
                  : <FaMicrophoneSlash className="text-[10px] text-red-400" />
                }
              </div>
              <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                You
              </div>
            </div>
          </div>

          <div className="absolute top-8 right-8 flex items-center gap-1.5 rounded-full bg-gray-900/80 border border-gray-700 px-3 py-1 text-xs text-gray-400 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            2 participants
          </div>
        </div>
      </div>

      {/* ── BOTTOM CONTROL BAR ── */}
      <footer className="shrink-0 border-t border-gray-800 bg-gray-900">
        {(notice || error) && (
          <div className="flex justify-center px-4 pt-2 gap-2">
            {notice && (
              <div className="flex items-center gap-2 rounded-full bg-gray-800 border border-gray-700 px-4 py-1.5 text-xs text-gray-300">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                {notice}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 rounded-full bg-red-900/50 border border-red-700/50 px-4 py-1.5 text-xs text-red-300">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                {error}
              </div>
            )}
          </div>
        )}

        <div className="flex h-20 items-center justify-center gap-3 px-6">
          {/* Mic */}
          <button
            type="button"
            onClick={handleToggleMic}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${micOn ? "text-white hover:bg-gray-800" : "text-red-400 hover:bg-gray-800"}`}
            aria-label="Toggle microphone"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${micOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-500/20 border border-red-500/50"}`}>
              {micOn ? <FaMicrophone className="text-sm" /> : <FaMicrophoneSlash className="text-sm text-red-400" />}
            </span>
            <span className="text-[10px] text-gray-400">{micOn ? "Mic" : "Unmute"}</span>
          </button>

          {/* Camera */}
          <button
            type="button"
            onClick={handleToggleCam}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${camOn ? "text-white hover:bg-gray-800" : "text-red-400 hover:bg-gray-800"}`}
            aria-label="Toggle camera"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${camOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-500/20 border border-red-500/50"}`}>
              {camOn ? <FaVideo className="text-sm" /> : <FaVideoSlash className="text-sm text-red-400" />}
            </span>
            <span className="text-[10px] text-gray-400">{camOn ? "Camera" : "Start video"}</span>
          </button>

          <div className="mx-2 h-10 w-px bg-gray-700" />

          {/* Answer button */}
          <button
            type="button"
            onClick={handleAnswerToggle}
            disabled={isSpeaking || isLoading || sessionEnded}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isListening ? "Stop answering" : "Start answering"}
          >
            <span
              className={`flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
                isListening
                  ? "bg-red-500 hover:bg-red-400 text-white shadow-[0_0_16px_rgba(239,68,68,0.5)]"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {isListening ? "Stop" : "Answer"}
            </span>
            <span className="text-[10px] text-gray-400">{isListening ? "Recording…" : "Tap to speak"}</span>
          </button>

          <div className="mx-2 h-10 w-px bg-gray-700" />

          {/* End call */}
          <button
            type="button"
            onClick={handleEndCall}
            disabled={isEndingSession}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="End call"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 hover:bg-red-500 transition shadow-[0_0_12px_rgba(220,38,38,0.4)]">
              <FaPhoneSlash className="text-sm" />
            </span>
            <span className="text-[10px] text-gray-400">End</span>
          </button>
        </div>
      </footer>
    </main>
  );
}
