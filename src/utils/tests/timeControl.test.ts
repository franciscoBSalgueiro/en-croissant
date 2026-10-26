import { expect, test } from "vitest";
import { getTimeControl } from "../timeControl";

test("classifies chess.com daily controls by format, not by website selection", () => {
    expect(getTimeControl("Chess.com", "1/259200")).toBe("daily");
    expect(getTimeControl("All websites", "1/259200")).toBe("daily");
    expect(getTimeControl(null, "1/86400")).toBe("daily");
});

test("classifies lichess correspondence controls by format, not by website selection", () => {
    expect(getTimeControl("Lichess", "-")).toBe("correspondence");
    expect(getTimeControl("All websites", "-")).toBe("correspondence");
    expect(getTimeControl(null, "-")).toBe("correspondence");
});

test("keeps chess.com rapid and blitz buckets for clock controls", () => {
    expect(getTimeControl("Chess.com", "180+0")).toBe("blitz");
    expect(getTimeControl("Chess.com", "600+0")).toBe("rapid");
});

test("keeps lichess buckets for clock controls", () => {
    expect(getTimeControl("Lichess", "29+0")).toBe("ultra_bullet");
    expect(getTimeControl("Lichess", "179+0")).toBe("bullet");
    expect(getTimeControl("Lichess", "180+0")).toBe("blitz");
    expect(getTimeControl("Lichess", "300+0")).toBe("blitz");
    expect(getTimeControl("Lichess", "600+0")).toBe("rapid");
    expect(getTimeControl("Lichess", "1800+0")).toBe("classical");
});
