"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LaunchpadPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = searchParams.get("token");

  useEffect(() => {
    // Redirect to the new trading page if token is provided
    if (tokenFromUrl) {
      router.replace(`/trade/${tokenFromUrl}`);
    } else {
      // Redirect to home page if no token specified
      router.replace("/");
    }
  }, [tokenFromUrl, router]);

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center">
      <div className="text-center">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4 text-base-content/70">Redirecting...</p>
      </div>
    </div>
  );
}
