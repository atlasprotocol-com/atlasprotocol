import Link from "next/link";

import { ConnectSmall } from "../Connect/ConnectSmall";
import { ThemeToggle } from "../ThemeToggle/ThemeToggle";

import { Logo } from "./Logo";

interface HeaderProps {
  onConnect: () => void;
  address: string;
  balanceSat: number;
  onDisconnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onConnect,
  address,
  balanceSat,
  onDisconnect,
}) => {
  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-sm shadow-sm py-2 px-4 md:py-6 sticky top-0 z-50">
      <div className="container mx-auto flex w-full max-w-7xl">
        <Link href="/" className="flex items-center">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-6">
          <div className="hidden md:block">
            <ConnectSmall
              onConnect={onConnect}
              address={address}
              balanceSat={balanceSat}
              onDisconnect={onDisconnect}
            />
          </div>
          <ThemeToggle />
        </div>
      </div>
      <div className="md:hidden flex justify-center mt-3">
        <ConnectSmall
          onConnect={onConnect}
          address={address}
          balanceSat={balanceSat}
          onDisconnect={onDisconnect}
        />
      </div>
    </nav>
  );
};
