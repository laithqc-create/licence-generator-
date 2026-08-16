"use client";

import type { CheckoutStep } from "@/types";

interface StatusIndicatorProps {
  step: CheckoutStep;
  txHash?: string;
}

interface Step {
  id: CheckoutStep | "confirming_verifying";
  label: string;
  description: string;
}

const STEPS: Step[] = [
  {
    id: "connected",
    label: "Wallet Connected",
    description: "Ready to initiate payment",
  },
  {
    id: "pending",
    label: "Awaiting Signature",
    description: "Approve the transaction in your wallet",
  },
  {
    id: "confirming_verifying",
    label: "On-Chain Confirmation",
    description: "Broadcasting to BNB Smart Chain",
  },
  {
    id: "success",
    label: "License Issued",
    description: "Subscription is now active",
  },
];

function getStepIndex(step: CheckoutStep): number {
  switch (step) {
    case "idle": return -1;
    case "connected": return 0;
    case "pending": return 1;
    case "confirming":
    case "verifying": return 2;
    case "success": return 3;
    case "error": return -1;
  }
}

export function StatusIndicator({ step, txHash }: StatusIndicatorProps) {
  if (step === "idle" || step === "error") return null;

  const currentIndex = getStepIndex(step);
  const bscScanUrl = txHash ? `https://bscscan.com/tx/${txHash}` : undefined;

  return (
    <div className="space-y-2 py-2">
      {STEPS.map((s, idx) => {
        const isCompleted = idx < currentIndex;
        const isActive = idx === currentIndex;
        const isPending = idx > currentIndex;

        return (
          <div key={s.id} className="flex items-start gap-3">
            {/* Step icon */}
            <div className="flex-shrink-0 mt-0.5">
              {isCompleted ? (
                <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : isActive ? (
                <div className="w-5 h-5 rounded-full border-2 border-teal-400 bg-teal-400/10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-navy-700 bg-navy-900" />
              )}
            </div>

            {/* Step text */}
            <div className="flex-1 min-w-0 pb-3">
              <p
                className={`text-sm font-medium ${
                  isCompleted
                    ? "text-teal-400"
                    : isActive
                    ? "text-white"
                    : "text-slate-600"
                }`}
              >
                {s.label}
              </p>
              {isActive && (
                <p className="text-xs text-slate-400 mt-0.5 animate-fade-in">
                  {step === "confirming" && bscScanUrl ? (
                    <a
                      href={bscScanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-teal-400"
                    >
                      Waiting for block confirmation →
                    </a>
                  ) : step === "verifying" ? (
                    "Verifying payment on our servers…"
                  ) : (
                    s.description
                  )}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
