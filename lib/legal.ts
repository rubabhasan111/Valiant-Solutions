// Who runs Halfshaft, as shown on the terms and privacy pages. The ABN and contact email are
// set in the environment (BUSINESS_ABN, CONTACT_EMAIL) so they can be added without a code
// change; the pages are built with them, so redeploy after changing either.
export const LEGAL = {
  operator: "Valiant Solutions",
  abn: process.env.BUSINESS_ABN?.trim() || null,
  contactEmail: process.env.CONTACT_EMAIL?.trim() || null,
  lastUpdated: "21 September 2026",
  // Set to true once a lawyer has reviewed both pages; until then they say they're drafts.
  reviewed: false,
};

export const operatorLine = () => `${LEGAL.operator}${LEGAL.abn ? ` (ABN ${LEGAL.abn})` : ""}`;
