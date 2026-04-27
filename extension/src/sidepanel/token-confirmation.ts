export function parseClarificationChoice(choice: string) {
  const parts = choice.split("|").map((part) => part.trim());
  if (parts.length < 3) return null;

  const [symbol, , mint] = parts;
  if (!symbol || !mint) return null;

  return { symbol, mint };
}

export function formatClarificationChoiceSummary(choice: string) {
  const parts = choice.split("|").map((part) => part.trim());
  if (parts.length < 3) return null;

  const [symbol, name, mint] = parts;
  if (!symbol || !name || !mint) return null;

  return `${symbol} · ${name} · ${mint}`;
}

export function applyTokenConfirmation(input: string, symbol: string) {
  const parsedChoice = parseClarificationChoice(symbol);
  const replacement = parsedChoice?.mint ?? symbol.toUpperCase();

  if (/\b(this|that|it)\b/i.test(input)) {
    return input.replace(/\b(this|that|it)\b/gi, replacement);
  }

  if (parsedChoice) {
    const escapedSymbol = parsedChoice.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const replacedInput = input.replace(new RegExp(`\\b${escapedSymbol}\\b`, "gi"), replacement);
    if (replacedInput !== input) {
      return replacedInput;
    }
  }

  return `${input.trim()} ${replacement}`.trim();
}
