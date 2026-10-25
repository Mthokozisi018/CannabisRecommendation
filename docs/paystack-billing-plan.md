# Paystack SaaS billing integration plan (test mode)

Status: test key configured in the ignored staging file; the SaaS billing schema, hosted checkout, callback, signed webhook, subscription provisioning, billing UI, and four-day grace job are implemented for staging. The staging database migration has been applied and verified. Public staging deployment and genuine Paystack checkout testing remain pending. See `docs/paystack-staging-implementation.md` for verified results and remaining limits. This plan covers GreenChoice's own software fees, not retail POS or customer checkout payments.

## Existing account flow

- GreenChoice Admin creates an independent manager with a temporary password. The manager changes it, accepts the legal documents, completes account setup, then registers a store. Franchise Admins follow a similar temporary-password and first-login setup after Admin creates the franchise and its administrator.
- Franchise stores are created by the Franchise Admin through an idempotent mutation. A franchise's stores have `stores.franchise_id`; the Franchise Admin profile has `staff_profiles.franchise_id`. Independent stores have no franchise ID.
- `store_access_status` and `is_active` currently control operational access. Admin can toggle these manually. The Admin "Active Subscriptions" statistic currently counts active stores; there is no SaaS subscription ledger behind it.
- `payment_transactions` belongs to customer orders (`order_id` is required). Reusing it for SaaS fees would mix unrelated financial flows. There is no implemented SaaS free trial or billing grace period in the repository.
- Existing onboarding creates identities and performs first-login password updates. Payment gates should be added *after* account and store setup, with billing recovery access maintained. Changing the temporary-password transaction itself would risk stranding new accounts.

## Gateway and pricing

- Use Paystack's server-side Transaction Initialize API and redirect the payer to its hosted authorization URL. The server holds `PAYSTACK_SECRET_KEY` and computes all amounts in ZAR cents. The browser never supplies a trusted price and never receives the secret. A `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` is unnecessary for this flow.
- Independent store: R2,500 once (250000 cents), then R1,500 monthly (150000 cents).
- Franchise: R4,500 once (450000 cents), then R2,500 monthly (250000 cents), including the first store, plus R1,000 (100000 cents) for each billable store after the first. The count must be queried by franchise ID under a transaction, and billing eligibility must be separate from payment restriction state.
- Onboarding checkout and subscription creation are separate operations. The verified first payment may supply a reusable card authorization. Create one monthly subscription per paying organization after the onboarding payment and billing-cycle decision are resolved. South African automatic subscriptions require a supported card authorization; a nonreusable authorization requires a new supported payment method.
- Use one account-specific Paystack plan per franchise so a price update cannot change another business's subscription. A plan update with `update_existing_subscriptions=true` takes effect on the next billing cycle. Keep the old and new amount, store count, effective date, provider plan code, and change reason in a billing-change ledger. No partial-month charges are proposed.
- Generate Paystack's hosted subscription-management link for updating a payment card. Treat this link and any authorization code as sensitive. Do not collect card details in GreenChoice.

## Proposed persistence and authorization

- Add distinct SaaS billing tables for organizations, onboarding charges, subscriptions, price revisions, provider events, and invoices/payments. Use UUID internal IDs, ZAR integer cents, unique provider references, unique one-time onboarding charges per organization, unique active subscription relationships, and provider event deduplication keys.
- Keep provider responses to an allowlist of safe IDs, amounts, status, timestamps, customer codes, and masked payment-method fields. Do not persist raw card payloads, full webhook bodies, or credentials. Store reusable authorization codes only if a supported flow genuinely needs them, with server-only access.
- Enable RLS for every new public table. Franchise Admin reads only the matching franchise; an independent store payer reads only the assigned business. Client roles cannot insert or update verified payment or entitlement rows. Backend service-role operations must recheck role, ownership, and account state. Receptionists have no organization billing access.
- Keep a separate SaaS entitlement/restriction state rather than deriving price from `store_access_status`. Propagate a franchise restriction to its stores in route, action, and database authorization checks while preserving billing and payment-recovery routes.

## Payment and renewal lifecycle

1. Authorized payer requests checkout. Backend creates or reuses one pending charge with a generated reference and fixed amount, then initializes Paystack checkout.
2. Callback and signed webhook both reconcile by the same reference. The backend fetches transaction verification from Paystack and checks test domain, successful status, reference, exact ZAR amount, and the internal paying organization before recording success. A browser redirect alone grants no access.
3. Handle `subscription.create`, `invoice.create`, `charge.success`, `invoice.payment_failed`, `invoice.update`, `subscription.not_renew`, and `subscription.disable` as idempotent events. Events can arrive out of order. A reconciliation worker verifies authoritative provider state before final entitlement changes.
4. A failed renewal records the invoice failure, starts a four-day grace deadline at the actual failure timestamp, and notifies the authorized payer. Paystack does not automatically retry failed subscription charges. Provide hosted card update and an explicit supported recovery payment flow; do not invent a silent retry.
5. A scheduled reconciliation task checks unresolved provider events, failed payments, grace expiry, and pending price changes. It restricts only the unpaid organization after rechecking successful payments. It never deletes business data. All recovery and billing pages remain reachable during restriction.

## Confirmed billing decisions

1. An independent store has one designated billing owner; the role of manager alone never grants billing access. The initial owner will be the manager who registers the store or the manager assigned by Admin during independent-store provisioning. A later owner change must be an explicit authorized action.
2. Operationally active franchise stores count toward the monthly price. Billing eligibility must remain distinct from a restriction caused by nonpayment so restriction cannot reduce the bill.
3. Store additions and deactivations change the amount at the next monthly renewal. There is no proration.
4. New businesses complete existing account setup, then pay the one-time onboarding fee before normal dashboard access. There is no free trial.
5. The first payment includes onboarding and the first month of hosting (R4,000 independent or R7,000 franchise with one store). The next monthly subscription debit is due one month after successful onboarding payment. Existing onboarding-only payments retain their recorded terms.

## Verification gates

- Unit tests for prices, eligibility, idempotency, state transitions, signature checks, verification mismatches, and out-of-order events.
- Database tests for unique charges, tenant isolation, server-only writes, concurrent store changes, and grace enforcement.
- Mocked gateway route tests and application build/lint/typecheck before staging.
- First real provider exercise, with test credentials only after deployment authorization: R4,000 independent-store onboarding and first-month checkout on public HTTPS staging, followed by declined payment and franchise tests. Verify the Paystack test dashboard and staging database independently. Monthly renewals that cannot happen immediately remain simulated lifecycle tests until a genuine provider event is observed.

## Official provider references

- https://paystack.com/docs/api/transaction/
- https://paystack.com/docs/payments/verify-payments/
- https://paystack.com/docs/payments/webhooks/
- https://paystack.com/docs/payments/subscriptions/
- https://paystack.com/docs/api/plan/
- https://paystack.com/docs/api/subscription/
