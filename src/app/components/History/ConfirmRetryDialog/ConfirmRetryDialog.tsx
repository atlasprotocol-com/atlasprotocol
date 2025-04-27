import { IoMdAlert } from "react-icons/io";

import { Button } from "@/app/components/Button";
import { Dialog } from "@/app/components/Dialog";

export interface ConfirmRetryDialogProps {
  open: boolean;
  onClose?: () => void;
  onRetry?: () => void;
  isPending?: boolean;
}

export function ConfirmRetryDialog({
  open,
  onClose,
  onRetry,
  isPending,
}: ConfirmRetryDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={isPending ? undefined : onClose}
      headerTitle="Retry Transaction"
      headerIcon={<IoMdAlert className="text-danger" />}
    >
      <div className="flex flex-col gap-3 break-words whitespace-normal">
        Do you want to retry the transaction?
      </div>

      <div className="mt-8 flex justify-around gap-4">
        <Button
          className="flex-1"
          intent={onRetry ? "outline" : "fill"}
          onClick={() => onClose?.()}
          disabled={isPending}
        >
          Close
        </Button>
        {onRetry && (
          <Button className="flex-1" onClick={onRetry} disabled={isPending}>
            Retry
          </Button>
        )}
      </div>
    </Dialog>
  );
}
