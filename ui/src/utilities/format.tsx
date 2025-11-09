export const fmtUSD = (n?: number | null) =>
  n == null ? "—" : `$${Number(n).toFixed(2)}`;
