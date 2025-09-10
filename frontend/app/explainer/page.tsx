"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExplainerRedirect() {
  const router = useRouter();
  useEffect(() => {
    try {
      router.replace("/info");
    } catch {
      // no-op
    }
  }, [router]);
  return (
    <main className="p-4 text-sm text-gray-600">
      Redirecting to Info & Methodology… If you are not redirected, <a className="text-blue-700 underline" href="/info">click here</a>.
    </main>
  );
}


