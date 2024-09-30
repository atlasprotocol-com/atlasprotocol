"use client";

import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useState } from "react";

import baseLogoBlack from "@/app/assets/base-logo-black.svg";
import baseLogo from "@/app/assets/base-logo.svg";

interface LogoProps {}

export const Logo: React.FC<LogoProps> = () => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const lightSelected = resolvedTheme === "light";
  const logo = lightSelected ? baseLogoBlack : baseLogo;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex items-center">
      <Image src={logo} alt="Atlas" height={40} loading="lazy" />
    </div>
  );
};
