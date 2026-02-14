export function formatNumber(value?: number): string {
  if (!value) return "0";
  return Intl.NumberFormat().format(value);
}

export function formatBytes(bytes: bigint | number, decimals = 2) {
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(Number(bytes)) / Math.log(k));

  return `${Number.parseFloat((Number(bytes) / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const secondsRemainder = seconds % 60;
  const minutesRemainder = minutes % 60;
  const hoursRemainder = hours % 24;
  const parts = [];
  if (days > 0) {
    parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  }
  if (hoursRemainder > 0) {
    parts.push(`${hoursRemainder} hour${hoursRemainder !== 1 ? "s" : ""}`);
  }
  if (minutesRemainder > 0) {
    parts.push(
      `${minutesRemainder} minute${minutesRemainder !== 1 ? "s" : ""}`,
    );
  }
  if (secondsRemainder > 0) {
    parts.push(
      `${secondsRemainder} second${secondsRemainder !== 1 ? "s" : ""}`,
    );
  }
  return parts.join(", ");
}

export function formatMove(orientation: string) {
  return orientation === "w" ? "white" : "black";
}

export function capitalize(str: string) {
  return `${str.charAt(0).toUpperCase()}${str.slice(1)}`;
}

export function formatThemeLabel(theme: string) {
  const normalized = theme
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-zA-Z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-zA-Z])/g, "$1 $2")
    .trim();

  if (!normalized) return theme;

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^\d+$/.test(word)) return word;
      return capitalize(word.toLowerCase());
    })
    .join(" ");
}

export function formatNodes(nodes: number) {
  if (nodes < 1000) return nodes.toFixed(0);
  return `${(nodes / 1000).toFixed(0)}k`;
}

export function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  }
  return `${seconds}.${tenths}s`;
}

export function getInitials(name: string) {
  const names = name.split(" ");
  const initials = names.map((n) => n.charAt(0).toUpperCase()).join("");
  return initials;
}

export function roundKeepSum(numbers: number[], targetSum = 100): number[] {
  if (numbers.every((num) => num === 0)) return numbers;
  const mappedNumbers = numbers.map((num, i) => ({
    originalValue: num,
    decimalPart: num - Math.floor(num),
    index: i,
    flooredValue: Math.floor(num),
  }));

  const currentSum = mappedNumbers.reduce(
    (sum, item) => sum + item.flooredValue,
    0,
  );

  const remainder = Math.round(targetSum - currentSum);

  mappedNumbers.sort((a, b) => b.decimalPart - a.decimalPart);

  for (let i = 0; i < remainder; i++) {
    mappedNumbers[i].flooredValue += 1;
  }

  return mappedNumbers
    .sort((a, b) => a.index - b.index)
    .map((item) => item.flooredValue);
}
