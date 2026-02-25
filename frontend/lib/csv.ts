/**
 * Parse CSV string into rows of cells.
 * Strips leading and trailing whitespace from each cell (and from each line)
 * so that accidental spaces in the data are removed.
 */
export function parseCsv(csv: string): string[][] {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => line.split(",").map((cell) => cell.trim()));
}
