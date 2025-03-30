import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import { twMerge } from "tailwind-merge";

interface ThemeToggleProps {}

// implementation so we avoid hydration error:
// https://github.com/pacocoursey/next-themes#avoid-hydration-mismatch
export const ThemeToggle: React.FC<ThemeToggleProps> = () => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const lightSelected = resolvedTheme === "light";

  const iconStyles = (active: boolean) =>
    `rounded-full p-1 transition duration-300 ease-in-out ${
      active ? "bg-primary text-primary-foreground" : "bg-transparent"
    }`;

  return (
    <button
      onClick={() => (lightSelected ? setTheme("dark") : setTheme("light"))}
      className={twMerge(
        "h-8 p-1 rounded-[40px] border border-primary items-center gap-1 inline-flex outline-none text-neutral-7",
        !lightSelected ? "bg-neutral-10" : "bg-neutral-3",
      )}
    >
      <div className={`${iconStyles(lightSelected)}`}>
        <FiSun size={16} />
      </div>
      <div className={`${iconStyles(!lightSelected)}`}>
        <FiMoon size={16} />
      </div>
    </button>
  );
};
