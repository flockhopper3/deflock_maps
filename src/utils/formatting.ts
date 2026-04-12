/**
 * Format a number with commas for thousands
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format percentage with sign
 */
export function formatPercent(value: number, showSign: boolean = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Extract city and state from Nominatim display name
 */
export function formatAddress(displayName: string): string {
  const parts = displayName.split(',').map((p) => p.trim());
  if (parts.length >= 3) {
    // Take first 3 meaningful parts
    return parts.slice(0, 3).join(', ');
  }
  return displayName;
}

