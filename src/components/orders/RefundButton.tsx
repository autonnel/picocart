import * as React from 'react';
import RefundModal from './RefundModal';

export interface RefundButtonProps {
  orderId: string;
  totalPrice: number;
  refundedSoFar: number;
  currencyCode: string;
  disabled?: boolean;
}

const RefundButton: React.FC<RefundButtonProps> = ({
  orderId,
  totalPrice,
  refundedSoFar,
  currencyCode,
  disabled,
}) => {
  const [open, setOpen] = React.useState(false);
  const remaining = Math.max(0, totalPrice - refundedSoFar);
  const isDisabled = disabled || remaining <= 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isDisabled}
        className="h-8 px-3 text-[13px] rounded-[7px] border border-ds-line bg-ds-card text-ds-ink hover:bg-[#F9FAFB] disabled:opacity-50"
      >
        Issue refund
      </button>
      <RefundModal
        orderId={orderId}
        open={open}
        onClose={() => setOpen(false)}
        totalPrice={totalPrice}
        refundedSoFar={refundedSoFar}
        currencyCode={currencyCode}
      />
    </>
  );
};

export default RefundButton;
