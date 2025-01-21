import { LuWallet } from "react-icons/lu";

import { Button } from "../Button";

function PhoneIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={50} height={50} fill="none">
      <path
        fill="currentColor"
        d="M26.41 25.018h-1.165v-1.166a.39.39 0 1 0-.78 0v1.166h-1.166a.39.39 0 1 0 0 .781h1.165v1.165a.39.39 0 0 0 .782 0V25.8h1.165a.39.39 0 1 0 0-.781ZM11.702 13.953a2.89 2.89 0 1 0 0 5.781 2.89 2.89 0 0 0 0-5.78Zm.262 4.202v.516h-.495v-.515c-.466-.072-.736-.356-.767-.752h.588c.045.21.202.337.44.337.293 0 .381-.14.381-.297 0-.196-.104-.291-.474-.4-.68-.2-.88-.453-.88-.834 0-.414.299-.669.685-.742v-.452h.491v.45c.494.077.68.38.708.707h-.589c-.027-.112-.075-.294-.38-.294-.246 0-.321.147-.321.272 0 .173.092.251.523.376.597.171.828.415.828.846 0 .462-.297.715-.738.782Z"
      />
      <path
        fill="currentColor"
        d="M47.14 26.633h-8.062V15.628h1.948c.216 0 .39.175.39.39v7.834a.39.39 0 0 0 .782 0v-7.834c0-.646-.526-1.172-1.172-1.172h-1.948V2.641A1.835 1.835 0 0 0 37.243.806h-23.67a1.834 1.834 0 0 0-1.835 1.835v9.844H2.86a.454.454 0 0 0-.454.454v9.703c0 .927.752 1.678 1.678 1.678h7.656v10.806H8.997a.391.391 0 0 1-.39-.39v-7.772a.39.39 0 1 0-.782 0v7.772c0 .646.526 1.171 1.172 1.171h2.742V47.36c0 1.013.822 1.835 1.835 1.835h23.67a1.835 1.835 0 0 0 1.834-1.835v-8.89h6.838c.927 0 1.678-.752 1.678-1.679v-9.703a.454.454 0 0 0-.454-.454ZM27.75 2.368h1.563a.39.39 0 0 1 0 .781H27.75a.39.39 0 0 1 0-.781Zm-6.25 0h3.906a.39.39 0 1 1 0 .781H21.5a.39.39 0 0 1 0-.781ZM3.187 13.266h17.031v7.712H3.187v-7.712Zm.896 10.273a.898.898 0 0 1-.897-.897v-.883h17.032v.883a.898.898 0 0 1-.897.897H4.083ZM25.41 47.296a.949.949 0 1 1 0-1.898.949.949 0 0 1 0 1.898Zm12.107-4.154c0 .35-.283.632-.632.632H13.93a.632.632 0 0 1-.632-.632v-7.235h7.414a.39.39 0 1 0 0-.781h-7.414V24.32h6.024c.927 0 1.678-.751 1.678-1.678v-9.703a.454.454 0 0 0-.453-.454h-7.249v-6.36c0-.35.284-.632.632-.632h22.955c.349 0 .632.283.632.631v8.722h-8.203a.39.39 0 0 0 0 .782h8.203v11.005h-8.062a.454.454 0 0 0-.454.454v9.703c0 .926.752 1.678 1.678 1.678h6.838v4.674Zm9.297-6.352a.898.898 0 0 1-.897.897H30.678a.898.898 0 0 1-.897-.897v-.883h17.032v.883ZM29.78 35.126v-7.712h17.032v7.712H29.78Z"
      />
      <path
        fill="currentColor"
        d="M38.297 28.1a2.89 2.89 0 1 0 0 5.782 2.89 2.89 0 0 0 0-5.781Zm.261 4.203v.516h-.495v-.515c-.466-.072-.735-.356-.767-.752h.589c.044.209.202.337.44.337.293 0 .381-.14.381-.297 0-.197-.104-.291-.474-.4-.681-.2-.88-.453-.88-.834 0-.414.299-.67.684-.742v-.453h.492v.45c.494.077.679.381.707.707h-.588c-.027-.111-.075-.293-.38-.293-.247 0-.322.146-.322.272 0 .173.093.25.524.376.597.17.828.415.828.846 0 .462-.297.715-.739.782ZM26.932 14.846h-3.08a.39.39 0 0 0 0 .782h3.08a.39.39 0 1 0 0-.782ZM26.17 35.126h-3.08a.39.39 0 0 0 0 .781h3.08a.39.39 0 0 0 0-.781Z"
      />
    </svg>
  );
}

export interface RequireConnectWalletProps {
  renderContent?: React.ReactNode;
  required?: boolean;
  onConnect?: () => void;
  description?: string;
}

export function RequireConnectWallet({
  renderContent,
  required = true,
  onConnect,
  description = "Please connect wallet to start staking",
}: RequireConnectWalletProps) {
  if (!required) {
    return <>{renderContent ? renderContent : <></>}</>;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-20 h-20 inline-flex items-center justify-center rounded-full bg-secondary-200 text-secondary-700 dark:bg-neutral-9 dark:text-neutral-7">
        <PhoneIcon />
      </div>
      <div className="flex flex-col gap-1 items-center">
        <p className="text-lg font-semibold">Connect Wallet</p>
        <p className="text-caption">{description}</p>
      </div>
      <Button
        className="min-w-[300px]"
        startIcon={<LuWallet />}
        onClick={onConnect}
      >
        Connect Wallet
      </Button>
    </div>
  );
}
