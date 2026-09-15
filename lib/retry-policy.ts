// How failed BECS debits are handled automatically. Money only ever moves by direct debit
// from the customer's bank account to the workshop's Stripe account, so a failed payment
// is retried with no limit until the customer pays.

// Days after a reported failure before the next attempt. 0 means the very next debit job
// run, so a failed payment is re-attempted as quickly as BECS allows.
export const RETRY_DELAY_DAYS = 0;

// Failure codes where retrying the same bank account can't succeed, so the plan pauses
// and the customer is asked for new bank details. Anything else (insufficient funds, a
// temporary bank problem) is retried automatically.
export const NEEDS_NEW_BANK_DETAILS = new Set([
  "account_closed",
  "bank_account_restricted",
  "bank_account_unusable",
  "debit_authorization_not_match",
  "debit_not_authorized",
  "invalid_account_number",
  "no_account",
  "no_payment_method",
  "payment_intent_mandate_invalid",
  "payment_method_unactivated",
]);
