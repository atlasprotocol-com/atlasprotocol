"use client";

import { ReactNode } from "react";

import { Logo } from "@/app/components/Header/Logo";
import { ThemeToggle } from "@/app/components/ThemeToggle/ThemeToggle";
import { network } from "@/config/network.config";
import { Network } from "@/utils/wallet/wallet_provider";

import { OnboardingStep } from "../hooks/useOnboarding";

import { StepIndicator } from "./StepIndicator";

interface OnboardingLayoutProps {
  children: ReactNode;
  currentStep: OnboardingStep;
}

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  children,
  currentStep,
}) => {
  return (
    <main
      className={`relative h-full min-h-svh w-full ${
        network === Network.MAINNET ? "main-app-mainnet" : "main-app-testnet"
      }`}
    >
      {/* Consistent Header with Atlas Logo */}
      <nav className="border-b border-header-border bg-header-bg shadow-sm py-2 px-4 md:py-6">
        <div className="container mx-auto flex w-full">
          <Logo />
          <div className="ml-auto flex items-center gap-7">
            <div className="text-sm text-neutral-6 dark:text-neutral-4">
              Welcome to Atlas
            </div>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Flex Container for Step Indicator and Content */}
          <div className="flex flex-col lg:flex-row items-center">
            {/* Step Indicator - Left Side */}
            <div className="flex-shrink-0 lg:sticky lg:top-8">
              <StepIndicator currentStep={currentStep} />
            </div>

            {/* Step Content - Right Side */}
            <div className="flex-1 bg-base-100 rounded-xl border border-neutral-5 dark:border-neutral-8 p-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
