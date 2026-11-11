"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/ui/premium-auth";
import { Logo } from "@/components/brand/logo";

function safeNextPath(raw: string): string {
  const n = (raw || "").trim();
  if (!n.startsWith("/") || n.startsWith("//")) return "/dashboard";
  return n;
}

function LoginInner() {
  const next = safeNextPath(useSearchParams().get("next") || "");
  const admin = next.startsWith("/admin");
  return (
    <div className="bg-background flex min-h-[70vh] w-full items-center justify-center px-4 py-10" dir="rtl">
      <div className="border-border bg-card w-full max-w-md rounded-2xl border shadow-sm">
        <div className="flex justify-center pt-8">
          <Logo size="lg" priority />
        </div>
        <AuthForm
          initialMode="login"
          hideRegister={admin}
          // پاس‌دادن خود next تا ?next=/admin/dashboard بعد از ورود حفظ شود
          defaultNext={admin ? next || "/admin/dashboard" : next || "/dashboard"}
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
