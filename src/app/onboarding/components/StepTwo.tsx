"use client";

import { useState } from "react";
import { FaDiscord, FaRetweet, FaTwitter } from "react-icons/fa";

import { Button } from "@/app/components/Button";
import { SocialTasks } from "../services/onboardingApi";

interface StepTwoProps {
  socialTasks: SocialTasks;
  onUpdateTask: (task: keyof SocialTasks, completed: boolean) => void;
  onNext: () => void;
  loading: boolean;
  allTasksCompleted: boolean;
}

interface SocialTaskProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText: string;
  doneText: string;
  completed: boolean;
  onAction: () => void;
  onMarkDone: () => void;
  actionUrl?: string;
}

const SocialTask: React.FC<SocialTaskProps> = ({
  icon,
  title,
  description,
  actionText,
  doneText,
  completed,
  onAction,
  onMarkDone,
  actionUrl,
}) => {
  const [hasClicked, setHasClicked] = useState(false);

  const handleAction = () => {
    if (actionUrl) {
      window.open(actionUrl, "_blank");
    }
    setHasClicked(true);
    onAction();
  };

  return (
    <div className="flex items-center justify-between p-4 border border-neutral-5 dark:border-neutral-8 rounded-lg">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-neutral-3 dark:bg-neutral-10">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-neutral-6 dark:text-neutral-4">
            {description}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {!completed && !hasClicked && (
          <Button
            onClick={handleAction}
            intent="outline"
            className="px-3 py-1 text-sm"
          >
            {actionText}
          </Button>
        )}

        {hasClicked && !completed && (
          <Button onClick={onMarkDone} className="px-3 py-1 text-sm">
            {doneText}
          </Button>
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
  loading,
  allTasksCompleted,
}) => {
  const socialTasksConfig = [
    {
      key: "followedX" as keyof SocialTasks,
      icon: <FaTwitter className="text-blue-500" size={20} />,
      title: "Follow @AtlasProtocol X account",
      description: "Follow @tobyxbt X account",
      actionText: "Follow",
      doneText: "Done",
      actionUrl: "https://x.com/_atlasprotocol",
    },
    {
      key: "joinedDiscord" as keyof SocialTasks,
      icon: <FaDiscord className="text-indigo-500" size={20} />,
      title: "Join @toby on Discord",
      description: "Join @toby on Discord",
      actionText: "Join Discord",
      doneText: "Done",
      actionUrl: undefined, // Empty for now as per requirements
    },
    {
      key: "retweetedPost" as keyof SocialTasks,
      icon: <FaRetweet className="text-green-500" size={20} />,
      title: "Retweet our Testnet Announcement[Optional]",
      description: "Retweet our Testnet Announcement[Optional]",
      actionText: "Retweet",
      doneText: "Done",
      actionUrl: "https://x.com/_atlasprotocol/status/1922955202916909078",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Connect social</h2>
        <p className="text-neutral-6 dark:text-neutral-4">
          Complete these social tasks to continue
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {socialTasksConfig.map((task) => (
          <SocialTask
            key={task.key}
            icon={task.icon}
            title={task.title}
            description={task.description}
            actionText={task.actionText}
            doneText={task.doneText}
            completed={socialTasks[task.key]}
            onAction={() => {}} // Just for tracking action click
            onMarkDone={() => onUpdateTask(task.key, true)}
            actionUrl={task.actionUrl}
          />
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          onClick={onNext}
          disabled={!allTasksCompleted || loading}
          className="px-8"
        >
          {loading ? "Processing..." : "Next"}
        </Button>
      </div>
    </div>
  );
};
