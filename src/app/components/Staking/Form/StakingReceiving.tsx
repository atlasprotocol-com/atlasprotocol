import { ChangeEvent, FocusEvent, useEffect, useState } from "react";

import { useChainConfig } from "@/app/context/api/ChainConfigProvider";

interface StakingReceivingProps {
  onStakingAddressChange: (inputReceivingAddress: string) => void;
  onStakingChainChange: (inputReceivingChainID: string, inputReceivingChain: string) => void;
  reset: boolean;
}

export const StakingReceiving: React.FC<StakingReceivingProps> = ({
  onStakingAddressChange,
  onStakingChainChange,
  reset,
}) => {
  const { chainConfigs } = useChainConfig(); 
  const [chain, setChain] = useState(""); 
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  // Track if the input field has been interacted with
  const [touched, setTouched] = useState(false);

  const errorLabel = "Receiving address";
  const generalErrorMessage = "You should input receiving address";

  // Use effect to reset the state when reset prop changes
  useEffect(() => {
    setChain("");
    setAddress("");
    setError("");
    setTouched(false);
    onStakingChainChange("", "");
  }, [reset]);

  const handleBlur = (_e: FocusEvent<HTMLInputElement>) => {
    setTouched(true);

    if (address === "") {
      setError(generalErrorMessage);
      return;
    }
  };

  const handleChainChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const chainName = e.target.value;
    const chainID = e.target.selectedOptions[0].getAttribute('data-key');

    // Allow the input to be changed freely
    setChain(chainName);
    onStakingChainChange(chainID || "", chainName);
  };

  const handleAddressChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Allow the input to be changed freely
    setAddress(newValue);

    if (touched && newValue === "") {
      setError(generalErrorMessage);
    } else {
      setError("");
    }

    onStakingAddressChange(newValue); // Inform parent component of address change
  };

  return (
    <label className="form-control w-full flex-1">
      <div className="label pt-0">
        <span className="label-text-alt text-base">Select Receiving Chain</span>
      </div>
      <select
        id="chain"
        name="chain"
        className="no-focus input input-bordered w-full"
        onChange={handleChainChange}
        value={chain}
      >
        <option value="">--Please select--</option>
        {Object.values(chainConfigs || {})
          .filter((chainConfig) => chainConfig.chainID !== "SIGNET") // Filter out Signet
          .map((chainConfig) => (
            <option key={chainConfig.chainID} value={chainConfig.networkName} data-key={chainConfig.chainID}>
              {chainConfig.networkName}
            </option>
          ))}
      </select>

      <div>
        <div className="label pt-0">
          <span className="label-text-alt text-base">
            Enter Receiving Address
          </span>
        </div>
        <input
          type="text"
          className={`no-focus input input-bordered w-full`}
          value={address}
          onChange={handleAddressChange}
          onBlur={handleBlur}
          // placeholder={coinName}
        />
      </div>
      {error && (
        <div className="my-2 min-h-[20px]">
          <p className="text-center text-sm text-error">{error}</p>
        </div>
      )}
    </label>
  );
};
