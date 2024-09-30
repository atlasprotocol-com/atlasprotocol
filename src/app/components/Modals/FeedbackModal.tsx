import Image from "next/image";
import { IoMdClose } from "react-icons/io";

import cancelledImage from "@/app/assets/cancelled.png";
import successfulImage from "@/app/assets/successful.png";

import { GeneralModal } from "./GeneralModal";

interface FeedbackModalProps {
  open: boolean;
  onClose: (value: boolean) => void;
  type: "success" | "cancel" | null;
}

const SuccessContent = () => {
  return (
    <div className="text-text-black dark:text-white flex flex-col items-center justify-center">
    
      <div className="mt-6 flex flex-col gap-4 items-center justify-center">
        <p>Congratulations!</p>
        <Image
          src={successfulImage}
          alt="Successful"
          width={150}
          height={150}
          className="my-4"
        />

        <p>Your transaction is successfully submitted!</p>
      </div>
    </div>
  );
};

const CancelContent = () => {
  return (
    <div className="text-text-black dark:text-white flex flex-col items-center justify-center">
    
      <div className="mt-6 flex flex-col gap-4">
        <Image
          src={cancelledImage}
          alt="Successful"
          width={150}
          height={150}
          className="my-4"
        />

        <p>Action cancelled!</p>
      </div>
    </div>
  );
};

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  open,
  onClose,
  type,
}) => {
  return (
    <GeneralModal open={open} onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold">
          {type === "success" ? "Successful" : "Cancelled"}
        </h3>
        <button
          className="btn btn-circle btn-ghost btn-sm"
          onClick={() => onClose(false)}
        >
          <IoMdClose size={24} />
        </button>
      </div>
      {type === "success" && <SuccessContent />}
      {type === "cancel" && <CancelContent />}
    </GeneralModal>
  );
};
