"use client";

import Image from "next/image";

interface LogoProps {}

export const Logo: React.FC<LogoProps> = () => {
  return (
    <div className="flex items-center">
      <Image
        src="/logo_text.svg"
        alt="Atlas Protocol"
        height={32}
        width={150}
        className="h-8 w-auto transition-all duration-200 hover:opacity-90 md:h-10 md:w-auto"
        priority
      />
    </div>
  );
};
