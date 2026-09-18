// Australian mobile numbers. Stored in international format (+614XXXXXXXX), which is what
// the SMS provider expects, and shown to people in the local format (0412 345 678).

export function normaliseAuMobile(input: string): string | null {
  const compact = input.replace(/[\s().-]/g, "");
  if (/^\+614\d{8}$/.test(compact)) return compact;
  if (/^614\d{8}$/.test(compact)) return `+${compact}`;
  if (/^04\d{8}$/.test(compact)) return `+61${compact.slice(1)}`;
  return null;
}

export function formatAuMobile(value: string): string {
  const normalised = normaliseAuMobile(value);
  const match = normalised?.match(/^\+61(4\d{2})(\d{3})(\d{3})$/);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : value;
}
