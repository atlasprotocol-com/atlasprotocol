"use client";

interface WalletDisplayProps {
  address: string;
  onLogout: () => void;
}

export const WalletDisplay: React.FC<WalletDisplayProps> = ({
  address,
  onLogout,
}) => {
  return (
    <div className="mb-4 p-3 border border-neutral-5 dark:border-neutral-8 rounded-lg bg-neutral-2 dark:bg-neutral-9">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-neutral-6 dark:text-neutral-4">
            Connected wallet:
          </p>
          <span className="text-primary font-mono text-xs">
            {address.slice(0, 8)}...{address.slice(-8)}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
        >
          Logout
        </button>
      </div>
    </div>
  );
};
