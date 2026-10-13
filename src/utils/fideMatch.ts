function normalizeName(name: string) {
    return name
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\s*,\s*/g, ",")
        .toLocaleLowerCase("en-US");
}

export function isMatchingFidePlayer(
    query: string,
    player: { name?: string; id?: number | string } | null | undefined,
) {
    if (!player) return false;
    const trimmed = query.trim();
    if (/^\d+$/.test(trimmed)) return String(player.id) === trimmed;
    return Boolean(player.name && normalizeName(player.name) === normalizeName(trimmed));
}
