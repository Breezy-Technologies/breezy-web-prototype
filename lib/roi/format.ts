/** Rounded integer with thousands separators. */
export const N = (n: number): string => Math.round(n).toLocaleString('en-US');

/** Floor area. */
export const SF = (n: number): string => `${N(n)} ft²`;

/** Full dollars. Uses a minus sign (U+2212), not a hyphen. */
export const M = (n: number): string =>
  `${n < 0 ? '−' : ''}$${N(Math.abs(n))}`;

/** Abbreviated dollars: $1.25M, $750K, $840. */
export const Mk = (n: number): string => {
  const a = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2).replace(/0$/, '')}M`;
  if (a >= 1000) return `${s}$${Math.round(a / 1000)}K`;
  return `${s}$${Math.round(a)}`;
};

/** Percentage, one decimal. */
export const PC = (n: number): string => `${(n * 100).toFixed(1)}%`;

/** Percentage, no decimals. */
export const PC0 = (n: number): string => `${Math.round(n * 100)}%`;
