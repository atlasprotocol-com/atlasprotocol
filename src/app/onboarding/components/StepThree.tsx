"use client";

import { useState } from "react";

import { Button } from "@/app/components/Button";
import { Input } from "@/app/components/Input";

import { onboardingApi } from "../services/onboardingApi";
import { WalletDisplay } from "./WalletDisplay";

interface StepThreeProps {
  onComplete: (email: string) => void;
  loading: boolean;
  address?: string;
  onLogout: () => void;
}

export const StepThree: React.FC<StepThreeProps> = ({
  onComplete,
  loading,
  address,
  onLogout,
}) => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [inviteCode, setInviteCode] = useState(["", "", "", "", "", ""]);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    if (emailError && validateEmail(value)) {
      setEmailError("");
    }
  };

  const handleInviteCodeChange = (index: number, value: string) => {
    // Only allow single characters/digits
    if (value.length <= 1) {
      const newCode = [...inviteCode];
      newCode[index] = value.toUpperCase();
      setInviteCode(newCode);

      // Auto-focus next input if current is filled
      if (value && index < 5) {
        const nextInput = document.getElementById(`invite-code-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    // Handle backspace to focus previous input
    if (e.key === "Backspace" && !inviteCode[index] && index > 0) {
      const prevInput = document.getElementById(`invite-code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleSubscribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setSubscribeLoading(true);
    setEmailError("");

    try {
      // Call API to submit email
      await onboardingApi.submitEmail(email);
      setSubscribeSuccess(true);
      console.log("Email subscription successful for:", email);
    } catch (error) {
      console.error("Failed to subscribe email:", error);
      setEmailError(
        error instanceof Error
          ? error.message
          : "Failed to submit email. Please try again.",
      );
    } finally {
      setSubscribeLoading(false);
    }
  };

  const handleAccessAtlas = () => {
    // Complete onboarding without email (empty string)
    onComplete("");
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Enter Invite code</h2>

        {address && <WalletDisplay address={address} onLogout={onLogout} />}

        {/* Crossed out invite code section with 6 input boxes */}
        <div className="mb-6 p-4 border border-neutral-5 dark:border-neutral-8 rounded-lg relative">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-[90%] h-0.5 bg-red-500"></div>
            </div>
            <div className="flex justify-center gap-3">
              {inviteCode.map((digit, index) => (
                <input
                  key={index}
                  id={`invite-code-${index}`}
                  type="text"
                  value={digit}
                  onChange={(e) =>
                    handleInviteCodeChange(index, e.target.value)
                  }
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-10 h-10 text-center border border-neutral-5 dark:border-neutral-8 rounded-md bg-neutral-2 dark:bg-neutral-9 text-neutral-8 dark:text-neutral-2 font-mono text-lg focus:outline-none focus:border-primary disabled:opacity-50"
                  maxLength={1}
                  disabled
                />
              ))}
            </div>
          </div>
        </div>

        <p className="text-neutral-6 dark:text-neutral-4">
          Skipped for Testnet, press &apos;Access Atlas&apos; below to enter.
        </p>

        <div className="mb-6">
          <p className="text-sm text-neutral-6 dark:text-neutral-4 mb-2">OR</p>
          <p className="text-neutral-6 dark:text-neutral-4 mb-4">
            Get notified via email
          </p>
        </div>
      </div>

      <form onSubmit={handleSubscribeSubmit} className="space-y-6">
        <div>
          <Input
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={handleEmailChange}
            className="w-full"
            required
          />
          {emailError && (
            <p className="text-red-500 text-sm mt-1">{emailError}</p>
          )}
          {subscribeSuccess && (
            <p className="text-green-500 text-sm mt-2 text-center">
              Thank you for subscribing, you may 'Access Atlas' below
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Button
            type="submit"
            intent="outline"
            disabled={subscribeLoading || !email.trim()}
            className="w-full"
          >
            {subscribeLoading ? "Processing..." : "Subscribe"}
          </Button>

          <Button
            type="button"
            onClick={handleAccessAtlas}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Processing..." : "Access Atlas"}
          </Button>
        </div>
      </form>
    </div>
  );
};
