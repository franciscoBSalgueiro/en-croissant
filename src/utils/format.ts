export function formatNumber(value?: number): string {
  if (!value) return "0";
  return Intl.NumberFormat().format(value);
}

export function formatBytes(bytes: number, decimals = 2) {
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
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

export function formatNodes(nodes: number) {
  if (nodes < 1000) return nodes.toFixed(0);
  return `${(nodes / 1000).toFixed(0)}k`;
}
