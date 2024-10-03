import { ChangeEvent, FocusEvent, useEffect, useState } from "react";

import { useChainConfig } from "@/app/context/api/ChainConfigProvider"; 
import { btcToSatoshi, satoshiToBtc } from "@/utils/btcConversions";
import { maxDecimals } from "@/utils/maxDecimals";

import { validateDecimalPoints } from "../../validation/validation";

interface RedemptionAmountProps {
  minStakingAmountSat: number;
  onRedemptionAmountChange: (inputAmountSat: number) => void;
  onRedemptionChainChange: (inputReceivingChainID: string) => void;
  reset: boolean;
  address?: string | null;
  formattedBalance?: string;
  balance?: number;
  onDisconnect?: () => Promise<void>;
  isDisconnecting?: boolean;
  selectedChain?: string;
}

export const RedemptionAmount: React.FC<RedemptionAmountProps> = ({
  minStakingAmountSat,
  onRedemptionAmountChange,
  onRedemptionChainChange,
  reset,
  address: evmAddress,
  formattedBalance,
  balance = 0,
  isDisconnecting,
  onDisconnect,
  selectedChain,
}) => {
  const { chainConfigs } = useChainConfig(); // Get the chain configurations from context
  
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const errorLabel = "Redemption amount";
  const generalErrorMessage = "You should input Redemption amount";

  useEffect(() => {
    setError("");
    setValue("");
    setTouched(false);
  }, [reset]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    setValue(newValue);

    if (touched && newValue === "") {
      setError(generalErrorMessage);
    } else {
      setError("");
    }
  };

  const handleChainChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const chainName = e.target.value;
    const chainID = e.target.selectedOptions[0].getAttribute("data-key");

    if (chainID && chainName !== "") {
      onRedemptionChainChange(chainID);
    } else {
      onRedemptionChainChange("");
    }
  };

  const handleBlur = (_e: FocusEvent<HTMLInputElement>) => {
    setTouched(true);

    if (value === "") {
      onRedemptionAmountChange(0);
      setError(generalErrorMessage);
      return;
    }

    const numValue = parseFloat(value);
    const satoshis = btcToSatoshi(numValue);

    const validations = [
      {
        valid: !isNaN(Number(value)),
        message: `${errorLabel} must be a valid number.`,
      },
      {
        valid: numValue !== 0,
        message: `${errorLabel} must be greater than 0.`,
      },
      {
        valid: satoshis <= balance,
        message: `${errorLabel} must be no more than ${formattedBalance} aBTC.`,
      },
      {
        valid: validateDecimalPoints(value),
        message: `${errorLabel} must have no more than 8 decimal points.`,
      },
    ];

    const firstInvalid = validations.find((validation) => !validation.valid);

    if (firstInvalid) {
      onRedemptionAmountChange(0);
      setError(firstInvalid.message);
    } else {
      setError("");
      onRedemptionAmountChange(satoshis);
      setValue(maxDecimals(satoshiToBtc(satoshis), 8).toString());
    }
  };

  const handleMaxClick = () => {
    const maxValue = satoshiToBtc(Number(balance));
    setValue(maxValue.toString());
    setError("");
    setTouched(true);
    onRedemptionAmountChange(Number(balance));
  };

  const minStakeAmount = maxDecimals(satoshiToBtc(minStakingAmountSat), 8);
  const maxStakeAmount = maxDecimals(satoshiToBtc(Number(balance)), 8);

  return (
    <label className="form-control w-full flex-1">
      <div className="label pt-0">
        <span className="label-text-alt text-base">
          Select Chain Holding aBTC
        </span>
      </div>
      <select
        id="chain"
        name="chain"
        className="no-focus input input-bordered w-full"
        onChange={handleChainChange}
        value={selectedChain}
      >
        <option value="">--Please select--</option>
        {Object.values(chainConfigs || {})
          .filter((chainConfig) => chainConfig.chainID !== "SIGNET") // Filter out Signet
          .map((chainConfig) => (
          <option
            key={chainConfig.chainID}
            value={chainConfig.chainID}
            data-key={chainConfig.chainID}
            
          >
            {chainConfig.networkName}
          </option>
        ))}
      </select>

      {evmAddress && (
        <>
          <div className="mt-2 label-text-alt opacity-50">
          <div className="flex justify-between">
              <span className="label-text-alt text-base">EVM Address:</span>
              <button
                onClick={() => {
                  onDisconnect?.();
                }}
                disabled={isDisconnecting}
              >
                Disconnect
              </button>
            </div>
            <p>{evmAddress }</p>
          </div>
        </>
      )}

      <div className="label pt-0 mt-4">
        <span className="label-text-alt text-base">Amount</span>
        <span
          className="label-text-alt opacity-50"
          onClick={handleMaxClick}
          style={{ cursor: "pointer" }}
        >
          min/max: {minStakeAmount}/{maxStakeAmount} aBTC
        </span>
      </div>
      <div className="flex">
        <input
          type="string"
          className={`no-focus input input-bordered w-full ${error && "input-error"}`}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="aBTC"
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
