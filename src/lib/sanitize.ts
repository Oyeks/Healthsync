/**
 * Sanitizes user input by stripping HTML tags and dangerous characters.
 * Applied at the boundary before storing patient-facing text.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

export function sanitizeFormData(
  raw: Record<string, string>,
  excludeFields: string[] = [],
): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    cleaned[key] = excludeFields.includes(key) ? value : sanitizeText(value);
  }
  return cleaned;
}
