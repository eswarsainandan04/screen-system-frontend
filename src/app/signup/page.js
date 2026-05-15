"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_ENDPOINT ||
  process.env.ENDPOINT ||
  "http://localhost:8000";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    if (!name || !email || !password) {
      setStatus("Please fill in all fields.");
      return;
    }

    if (password !== confirm) {
      setStatus("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus(data?.detail || "Signup failed.");
        return;
      }

      setStatus(`Account created for ${data.name}.`);
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
      setName("");
      setEmail("");
      setPassword("");
      setConfirm("");
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
        <h1 className="text-3xl font-bold text-center mb-8">Sign Up</h1>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Full Name"
            className="border p-3 rounded-xl outline-none"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

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

          <input
            type="password"
            placeholder="Confirm Password"
            className="border p-3 rounded-xl outline-none"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-black text-white py-3 rounded-xl hover:opacity-90 transition disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create Account"}
          </button>
        </form>

        {status ? (
          <p className="text-center mt-4 text-sm text-gray-700">{status}</p>
        ) : null}

        <p className="text-center mt-5 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold underline">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}