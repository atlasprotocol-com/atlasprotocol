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

        {/* Crossed out invite code section */}
        <div className="mb-6 p-4 border border-neutral-5 dark:border-neutral-8 rounded-lg relative">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-0.5 bg-red-500"></div>
            </div>
            <p className="text-neutral-4 dark:text-neutral-6 line-through">
              (I don&apos;t receive invite from community)
            </p>
          </div>
        </div>

        <p className="text-neutral-6 dark:text-neutral-4 mb-6">
          Skipped for Testnet, press &apos;Access Atlas&apos; below to enter.
        </p>

        <div className="mb-6">
          <p className="text-sm text-neutral-6 dark:text-neutral-4 mb-2">Or</p>
          <p className="text-sm text-neutral-6 dark:text-neutral-4 mb-4">
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
