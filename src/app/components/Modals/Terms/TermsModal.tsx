import { Dialog } from "../../Dialog";

import { Terms } from "./data/terms";

interface TermsModalProps {
  open: boolean;
  onClose: (value: boolean) => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onOpenChange={onClose} headerTitle="Terms of Use">
      <div className="max-h-[calc(100vh-200px)] overflow-auto">
        <Terms />
      </div>
    </Dialog>
  );
};
