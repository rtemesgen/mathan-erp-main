export function required(value: unknown, label: string): string | undefined {
  if (value === null || value === undefined || String(value).trim() === '') return `${label} is required`;
  return undefined;
}

export function positiveNumber(value: unknown, label: string): string | undefined {
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return `${label} must be greater than zero`;
  return undefined;
}

export function nonZeroNumber(value: unknown, label: string): string | undefined {
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed === 0) return `${label} cannot be zero`;
  return undefined;
}

export function validateDateRange(start: string, end: string): string | undefined {
  if (!start || !end) return undefined;
  if (end < start) return 'End date must be on or after start date';
  return undefined;
}

export function firstValidationError(errors: Array<string | undefined>): string | undefined {
  return errors.find(Boolean);
}
