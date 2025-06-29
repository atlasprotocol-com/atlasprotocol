"use client";

import { useState } from "react";
import { FaDiscord, FaRetweet, FaTwitter } from "react-icons/fa";

import { Button } from "@/app/components/Button";

import { SocialTasks } from "../services/onboardingApi";

import { OnboardingCompleteModal } from "./OnboardingCompleteModal";
import { WalletDisplay } from "./WalletDisplay";

interface StepTwoProps {
  socialTasks: SocialTasks;
  onUpdateTask: (task: keyof SocialTasks, completed: boolean) => void;
  onNext: () => void;
  onAccessAtlas: () => void;
  loading: boolean;
  accessAtlasLoading: boolean;
  allTasksCompleted: boolean;
  address?: string;
  onLogout: () => void;
  walletType?: "BTC" | "NEAR" | null;
}

interface SocialTaskProps {
  icon: React.ReactNode;
  title: string;
  actionText: string;
  doneText: string;
  completed: boolean;
  onAction: () => void;
  onMarkDone: () => void;
  actionUrl?: string;
  required: boolean;
}

const SocialTask: React.FC<SocialTaskProps> = ({
  icon,
  title,
  actionText,
  doneText,
  completed,
  onAction,
  onMarkDone,
  actionUrl,
  required,
}) => {
  const handleAction = () => {
    if (actionUrl) {
      window.open(actionUrl, "_blank");
    }
    // Auto-mark as done immediately after action
    onMarkDone();
    onAction();
  };

  return (
    <div className="flex items-center justify-between p-4 border border-neutral-5 dark:border-neutral-8 rounded-lg">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-neutral-3 dark:bg-neutral-10">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold">
            {title}
            {!required && (
              <span className="text-neutral-5 dark:text-neutral-6 text-sm ml-2">
                (Optional)
              </span>
            )}
          </h3>
        </div>
      </div>

      <div className="flex gap-2">
        {!completed && (
          <>
            {actionUrl && (
              <Button
                onClick={handleAction}
                variant="outline"
                className="px-3 py-1 text-sm"
              >
                {actionText}
              </Button>
            )}
            {!actionUrl && (
              <Button onClick={onMarkDone} className="px-3 py-1 text-sm">
                {doneText}
              </Button>
            )}
          </>
        )}

        {completed && (
          <div className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-sm font-medium">
            ✓ Done
          </div>
        )}
      </div>
    </div>
  );
};

export const StepTwo: React.FC<StepTwoProps> = ({
  socialTasks,
  onUpdateTask,
  onNext,
  onAccessAtlas,
  loading,
  accessAtlasLoading,
  allTasksCompleted,
  address,
  onLogout,
  walletType = null,
}) => {
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const socialTasksConfig = [
    {
      key: "followedX" as keyof SocialTasks,
      icon: <FaTwitter className="text-blue-500" size={20} />,
      title: "Follow @_atlasprotocol on X",
      actionText: "Follow",
      doneText: "Done",
      actionUrl: "https://x.com/_atlasprotocol",
      required: true,
    },
    {
      key: "joinedDiscord" as keyof SocialTasks,
      icon: <FaDiscord className="text-indigo-500" size={20} />,
      title: "Join our Atlas Protocol Discord Community",
      actionText: "Join Discord",
      doneText: "Done",
      actionUrl: "https://discord.com/invite/atlasprotocol",
      required: true,
    },
    {
      key: "retweetedPost" as keyof SocialTasks,
      icon: <FaRetweet className="text-green-500" size={20} />,
      title: "Retweet our Testnet Annoucement [Optional]",
      actionText: "Retweet",
      doneText: "Done",
      actionUrl: "https://x.com/_atlasprotocol/status/1922955202916909078",
      required: false,
    },
  ];

  // Calculate progress
  const requiredTasks = socialTasksConfig.filter((task) => task.required);
  const completedRequiredTasks = requiredTasks.filter(
    (task) => socialTasks[task.key],
  );
  const progressPercentage =
    (completedRequiredTasks.length / requiredTasks.length) * 100;

  const handleAccessAtlasClick = () => {
    setShowCompleteModal(true);
  };

  const handleModalAccessAtlas = async () => {
    setShowCompleteModal(false);
    await onAccessAtlas();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Connect social</h2>
        {address && <WalletDisplay address={address} onLogout={onLogout} />}
        <p className="text-neutral-6 dark:text-neutral-4 mb-4">
          Complete the first two tasks to continue. The retweet task is
          optional.
        </p>

        {/* Progress indicator */}
        <div className="max-w-md mx-auto">
          <div className="flex justify-between text-sm text-neutral-6 dark:text-neutral-4 mb-2">
            <span>Progress</span>
            <span>
              {completedRequiredTasks.length}/{requiredTasks.length} required
              tasks
            </span>
          </div>
          <div className="w-full bg-neutral-3 dark:bg-neutral-8 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          {allTasksCompleted && (
            <p className="text-green-600 dark:text-green-400 text-sm mt-2 font-medium">
              ✓ Ready to proceed to next step!
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 mb-8">
        {socialTasksConfig.map((task) => (
          <SocialTask
            key={task.key}
            icon={task.icon}
            title={task.title}
            actionText={task.actionText}
            doneText={task.doneText}
            completed={socialTasks[task.key]}
            onAction={() => {}} // Just for tracking action click
            onMarkDone={() => onUpdateTask(task.key, true)}
            actionUrl={task.actionUrl}
            required={task.required}
          />
        ))}
      </div>

      <div className="flex justify-center gap-4">
        <Button
          onClick={onNext}
          disabled={!allTasksCompleted || loading || accessAtlasLoading}
          className="px-8"
        >
          {loading ? "Processing..." : "Next"}
        </Button>
        <Button
          onClick={handleAccessAtlasClick}
          disabled={!allTasksCompleted || loading || accessAtlasLoading}
          variant="outline"
          className="px-8"
        >
          Access Atlas
        </Button>
      </div>

      <OnboardingCompleteModal
        open={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        onAccessAtlas={handleModalAccessAtlas}
        walletType={walletType}
        isLoading={accessAtlasLoading}
      />
    </div>
  );
};
