import { IoMdAlert, IoMdCheckmarkCircle } from "react-icons/io";

import { Button } from "../Button";
import { Dialog } from "../Dialog";

export interface FeedbackDialogProps {
  open: boolean;
  onClose?: () => void;
  onRetry?: () => void;
  title?: string;
  type?: "success" | "error";
  content?: React.ReactNode;
}

export function FeedbackDialog({
  open,
  onClose,
  title,
  onRetry,
  type,
  content,
}: FeedbackDialogProps) {
  function handleRetry() {
    if (onRetry) {
      onRetry();
      onClose?.();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onClose}
      headerTitle={title}
      headerIcon={
        type === "success" ? (
          <IoMdCheckmarkCircle className="text-success" />
        ) : type === "error" ? (
          <IoMdAlert className="text-danger" />
        ) : null
      }
    >
      <div className="flex flex-col gap-3 break-words whitespace-normal">
        {content}
      </div>

      <div className="mt-8 flex justify-around gap-4">
        <Button
          className="flex-1"
          intent={onRetry ? "outline" : "fill"}
          onClick={() => onClose?.()}
        >
          Close
        </Button>
        {onRetry && (
          <Button className="flex-1" onClick={handleRetry}>
            Try Again
          </Button>
        )}
      </div>
    </Dialog>
  );
}
