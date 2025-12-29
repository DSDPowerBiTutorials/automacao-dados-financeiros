"use client";


import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BankAccountsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new location in Cash Management
    router.push("/cash-management/bank-accounts");
  }, [router]);

  return (
    <div className="p-6 text-center">
      <p className="text-gray-600">Redirecting to Bank Accounts...</p>
    </div>
  );
}
