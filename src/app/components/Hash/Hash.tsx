import { useEffect, useState } from "react";
import { FiCopy } from "react-icons/fi";
import { IoIosCheckmarkCircle } from "react-icons/io";
import { useCopyToClipboard } from "usehooks-ts";

import { trim } from "@/utils/trim";

interface HashProps {
  value: string;
  noFade?: boolean;
  address?: boolean;
  small?: boolean;
  fullWidth?: boolean;
}

export const Hash: React.FC<HashProps> = ({
  value,
  noFade,
  address,
  small,
  fullWidth,
}) => {
  const [_value, copy] = useCopyToClipboard();
  const [copiedText, setCopiedText] = useState("");

  const handleCopy = () => {
    setCopiedText("Copied!");
    copy(value);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setCopiedText("");
    }, 2000);
    return () => clearTimeout(timer);
  }, [copiedText]);

  return (
    <div
      className={`inline-flex min-h-[25px] cursor-pointer items-center ${
        !noFade && "opacity-50"
      } hover:opacity-100`}
      onClick={handleCopy}
    >
      <p
        className={`${fullWidth ? "w-full" : ""} ${small ? "min-w-[3.5rem]" : "min-w-[5.5rem]"}`}
      >
        {copiedText || (
          <>
            {!address && (
              <>
                <span>0</span>
                <span className="font-mono">x</span>
              </>
            )}
            <span>{trim(value)}</span>
          </>
        )}
      </p>
      {copiedText ? (
        <IoIosCheckmarkCircle className="ml-1" />
      ) : (
        <FiCopy className="ml-1" />
      )}
    </div>
  );
};
