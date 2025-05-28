"use client";

import { useState } from "react";

import { Button } from "@/app/components/Button";
import { Input } from "@/app/components/Input";

interface StepThreeProps {
  onComplete: (email: string) => void;
  loading: boolean;
}

export const StepThree: React.FC<StepThreeProps> = ({
  onComplete,
  loading,
}) => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [inviteCode, setInviteCode] = useState(["", "", "", "", "", ""]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    onComplete(email);
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Enter Invite code</h2>

        {/* Crossed out invite code section with 6 input boxes */}
        <div className="mb-6 p-4 border border-neutral-5 dark:border-neutral-8 rounded-lg relative">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-full h-0.5 bg-red-500"></div>
            </div>
            <div className="flex justify-center gap-2">
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

      <form onSubmit={handleSubmit} className="space-y-6">
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
        </div>

        <div className="space-y-3">
          <Button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full"
          >
            {loading ? "Processing..." : "Subscribe"}
          </Button>

          <Button
            type="button"
            intent="outline"
            onClick={() => onComplete("")}
            disabled={loading}
            className="w-full"
          >
            Access Atlas
          </Button>
        </div>
      </form>
    </div>
  );
};
