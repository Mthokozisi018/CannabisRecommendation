if (process.env.GREENCHOICE_ENV !== "staging"
  || process.env.PAYSTACK_MODE !== "test"
  || process.env.PAYSTACK_BILLING_ENABLED !== "true"
  || !process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_")) {
  throw new Error("The staging runtime did not load a Paystack test key safely.");
}
console.log("Staging runtime loaded Paystack test configuration; credential value suppressed.");
