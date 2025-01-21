import { useFeedbackStore } from "@/app/stores/feedback";

import { FeedbackDialog } from "../FeedbackDialog";

export function FeedbackRenderer() {
  const feedbacks = useFeedbackStore((state) => state.feedbacks);
  const removeFeedback = useFeedbackStore((state) => state.removeFeedback);

  function handleRemoveFeedback(key: string) {
    const currentFeedback = feedbacks[key];
    if (currentFeedback.onClose) {
      currentFeedback.onClose();
    }
    removeFeedback(key);
  }

  return (
    <div className="feedback-renderer">
      {Object.entries(feedbacks).map(([key, feedback]) => (
        <FeedbackDialog
          open
          key={key}
          onClose={() => handleRemoveFeedback(key)}
          title={feedback.title}
          type={feedback.type}
          content={feedback.content}
          onRetry={feedback.onRetry}
        />
      ))}
    </div>
  );
}
