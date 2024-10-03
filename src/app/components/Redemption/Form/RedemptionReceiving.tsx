import { ChangeEvent, FocusEvent, useEffect, useState } from "react";

interface RedemptionReceivingProps {
  redemptionAddress: string;
}

export const RedemptionReceiving: React.FC<RedemptionReceivingProps> = ({
  redemptionAddress,
}) => {
 
  return (
    <label className="form-control w-full flex-1">
      <div>
        <div className="label pt-0">
          <span className="label-text-alt text-base">
            BTC Receiving Address
          </span>
        </div>
        <textarea
          className="no-focus input  w-full cursor-not-allowed"
          value={redemptionAddress}
          readOnly
          rows={2}
          style={{ height: '100px' }}
        />
      </div>
    </label>
  );
};
