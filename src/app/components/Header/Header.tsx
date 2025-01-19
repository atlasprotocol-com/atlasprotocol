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
    <nav className="border-b border-header-border bg-header-bg shadow-sm py-2 px-4 md:py-6">
      <div className="container mx-auto flex w-full">
        <Link href="/">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-7">
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
