// Form parsing helpers shared by server actions and client-side previews.

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function formText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// "1,284.60", "$1284.6" and "1284" all parse; anything with more than two decimal
// places or other characters returns null.
export function parseAudToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [dollars, cents = ""] = cleaned.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}
