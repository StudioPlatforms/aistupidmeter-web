/**
 * The workload assessment's price, in one place. Client-safe (no server imports), so the pricing
 * page, the assessment page and lib/assessment.ts all read the same number. The Stripe Price
 * behind checkout (STRIPE_PRICE_ASSESSMENT) must match it: Stripe prices are immutable, so a new
 * amount means a new Price and a new env value.
 */
export const ASSESSMENT_PRICE_USD = 1290;
export const ASSESSMENT_PRICE_LABEL = '$1,290';
