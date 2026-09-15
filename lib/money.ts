const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function formatAud(cents: number): string {
  return aud.format(cents / 100);
}
