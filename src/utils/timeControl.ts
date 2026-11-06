export function getTimeControl(website: string | null, timeControl: string) {
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
