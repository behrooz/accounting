"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithUsernamePassword } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const user = await loginWithUsernamePassword(username, password);
      if (!user) {
        setError("نام کاربری یا رمز عبور اشتباه است.");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError("نام کاربری یا رمز عبور اشتباه است.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded border border-[#d5dbdb] bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-[#16191f]">ورود به سامانه</h1>
        <p className="mt-2 text-sm text-[#545b64]">
          برای دسترسی به پنل حسابداری وارد شوید.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-[#545b64]">نام کاربری</span>
            <input
              className="w-full rounded border border-[#aab7b8] px-3 py-2 outline-none ring-[#0073bb] focus:ring"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-[#545b64]">رمز عبور</span>
            <input
              type="password"
              className="w-full rounded border border-[#aab7b8] px-3 py-2 outline-none ring-[#0073bb] focus:ring"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="******"
              required
            />
          </label>

          {error && (
            <p className="rounded bg-[#fdf3f1] px-3 py-2 text-sm text-[#d13212]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded bg-[#0073bb] py-2.5 font-medium text-white transition hover:bg-[#006499]"
          >
            ورود
          </button>
        </form>

        <div className="mt-5 rounded border border-dashed border-[#d5dbdb] bg-[#f8f9f9] p-3 text-xs text-[#545b64]">
          <p>کاربر پیش‌فرض:</p>
          <p>نام کاربری: admin</p>
          <p>رمز عبور: 123456</p>
        </div>
      </div>
    </div>
  );
}
