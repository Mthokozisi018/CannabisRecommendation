if (process.env.GREENCHOICE_ENV !== "staging" ||
    process.env.PAYSTACK_MODE !== "test" ||
    !process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_") ||
    process.env.EXPECTED_SUPABASE_PROJECT_REF === process.env.PRODUCTION_SUPABASE_PROJECT_REF) {
  throw new Error("Paystack test isolation guard failed");
}
const response = await fetch("https://api.paystack.co/transaction/verify/gc-phase3-nonexistent", {
  headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  signal: AbortSignal.timeout(10000),
});
const body = await response.json();
if (response.status !== 400 || body.status !== false) {
  throw new Error(`Unexpected test verification response: HTTP ${response.status}`);
}
console.log("Paystack test API authenticated; nonexistent reference safely rejected without a charge.");
