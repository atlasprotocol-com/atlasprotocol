"use client";

import { OnboardingStep } from "../hooks/useOnboarding";

interface StepIndicatorProps {
  currentStep: OnboardingStep;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
}) => {
  const steps = [
    { number: 1, label: "Connect\nWallet", key: "wallet" },
    { number: 2, label: "Connect\nSocials", key: "socials" },
    { number: 3, label: "Referral Code", key: "referral" },
  ];

  const getStepClasses = (stepNumber: number) => {
    const isActive = stepNumber === currentStep;
    const isCompleted = stepNumber < currentStep;

    if (isCompleted) {
      return "bg-primary text-white border-primary";
    }
    if (isActive) {
      return "bg-primary text-white border-primary";
    }
    return "bg-neutral-3 dark:bg-neutral-10 text-neutral-6 dark:text-neutral-4 border-neutral-5 dark:border-neutral-8";
  };

  const getConnectorClasses = (stepNumber: number) => {
    const isCompleted = stepNumber < currentStep;
    return isCompleted ? "bg-primary" : "bg-neutral-5 dark:bg-neutral-8";
  };

  return (
    <div className="flex flex-col items-start space-y-4 min-w-[200px]">
      {steps.map((step, index) => (
        <div key={step.key} className="flex flex-col items-center w-full">
          {/* Step Circle and Label */}
          <div className="flex flex-col items-center gap-3 w-full">
            <div
              className={`
                w-10 h-10 rounded-full border-2 flex items-center justify-center
                text-sm font-semibold transition-all duration-200 flex-shrink-0
                ${getStepClasses(step.number)}
              `}
            >
              {step.number}
            </div>
            <p className="text-sm text-neutral-8 dark:text-neutral-2 font-medium">
              {step.label}
            </p>
          </div>

          {/* Vertical Connector Line */}
          {index < steps.length - 1 && (
            <div className="flex justify-start mt-3 mb-1">
              <div
                className={`
                  w-0.5 h-6 transition-all duration-200
                  ${getConnectorClasses(step.number)}
                `}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
