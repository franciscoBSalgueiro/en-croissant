export function getTimeControl(website: string | null, timeControl: string) {
    // Daily and correspondence controls are unambiguous from the control string
    // itself, so classify them before falling back to website-specific thresholds.
    if (timeControl.startsWith("1/")) {
        return "daily";
    }
    if (timeControl === "-") {
        return "correspondence";
    }
    const [initial, increment = 0] = timeControl.split("+").map(Number);
    if (website === "Chess.com") {
        const total = initial + increment * 40;
        return total < 180 ? "bullet" : total <= 500 ? "blitz" : "rapid";
    }
    const total = initial + increment * 40;
    return total < 30
        ? "ultra_bullet"
        : total < 180
          ? "bullet"
          : total < 480
            ? "blitz"
            : total < 1500
              ? "rapid"
              : "classical";
}
