import { useCallback } from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface FeedbackData {
  onRetry?: () => void;
  title?: string;
  type?: "success" | "error";
  content?: React.ReactNode;
  onClose?: () => void;
}

export interface FeedbackState {
  feedbacks: {
    [key: string]: FeedbackData;
  };
}

type Actions = {
  addFeedback: (id: string, item: FeedbackData) => void;
  removeFeedback: (id: string) => void;
};

export const useFeedbackStore = create<FeedbackState & Actions>()(
  immer((set) => ({
    feedbacks: {},
    addFeedback: (id, item) => {
      set((state) => {
        state.feedbacks[id] = item;
      });
    },
    removeFeedback: (id) => {
      set((state) => {
        delete state.feedbacks[id];
      });
    },
  })),
);

export function useAddFeedback() {
  const addFeedbackStore = useFeedbackStore((state) => state.addFeedback);

  const addFeedback = useCallback(
    (item: FeedbackData) => {
      addFeedbackStore(Date.now().toString(), item);
    },
    [addFeedbackStore],
  );

  return {
    addFeedback,
  };
}
