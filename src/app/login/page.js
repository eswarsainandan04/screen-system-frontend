"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = "https://screen-system-backend-production.up.railway.app";
 


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    if (!email || !password) {
      setStatus("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus(data?.detail || "Login failed.");
        return;
      }

      setStatus(`Welcome back, ${data.name}.`);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "userProfile",
          JSON.stringify({
            userid: data.userid,
            name: data.name,
            email: data.email,
          })
        );
      }
      router.push("/dashboard");
    } catch (error) {
      setStatus("Unable to reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-2xl shadow-lg w-[400px]">
        <h1 className="text-3xl font-bold text-center mb-8">Login</h1>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            className="border p-3 rounded-xl outline-none"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="border p-3 rounded-xl outline-none"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-black text-white py-3 rounded-xl hover:opacity-90 transition disabled:opacity-60"
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>

        {status ? (
          <p className="text-center mt-4 text-sm text-gray-700">{status}</p>
        ) : null}

        <p className="text-center mt-5 text-sm">
          Don't have an account?{" "}
          <Link href="/signup" className="font-semibold underline">
            Sign Up
          </Link>
        </p>
      </div>
    </main>
  );
}
