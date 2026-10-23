export function CheckoutStepBadge({ step }: { step: 1 | 2 | 3 }) {
  return (
    <span
      data-checkout-step={step}
      className="inline-grid size-9 shrink-0 place-items-center rounded-full bg-blue-700 text-lg font-bold leading-none text-white"
    >
      <span className="sr-only">Step </span>
      {step}
    </span>
  );
}
