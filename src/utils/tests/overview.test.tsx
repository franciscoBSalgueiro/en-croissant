import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import type { PlayerGameInfo, StatsData } from "@/bindings";
import OverviewPanel from "@/components/home/PersonalCardPanels/OverviewPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}: ${options.count}`,
    i18n: { resolvedLanguage: "en-US" },
  }),
}));

vi.mock("@mantine/core", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Box: Container,
    Divider: () => <hr />,
    Group: Container,
    Stack: Container,
    Text: Container,
    Tooltip: Container,
    Progress: {
      Root: Container,
      Label: ({ children }: { children: ReactNode }) => <span>{children}</span>,
      Section: ({
        children,
        value,
        color,
      }: {
        children?: ReactNode;
        value: number;
        color: string;
      }) => (
        <div role="progressbar" aria-valuenow={value} data-color={color}>
          {children}
        </div>
      ),
    },
    Select: ({
      label,
      value,
      onChange,
      data,
    }: {
      label: string;
      value: string;
      onChange: (value: string) => void;
      data: { value: string; label: string }[];
    }) => (
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {data.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ data }: { data: unknown }) => (
    <output data-testid="activity">{JSON.stringify(data)}</output>
  ),
  Bar: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock("@/components/home/PersonalCardPanels/ResultsChart", () => ({
  default: ({ won, draw, lost }: { won: number; draw: number; lost: number }) => (
    <output data-testid="results">{JSON.stringify({ won, draw, lost })}</output>
  ),
}));

vi.mock("@/components/home/PersonalCardPanels/WebsiteAccountSelector", () => ({
  default: ({
    onWebsiteChange,
    onAccountChange,
  }: {
    onWebsiteChange: (value: string) => void;
    onAccountChange: (value: string) => void;
  }) => (
    <button
      onClick={() => {
        onWebsiteChange("Chess.com");
        onAccountChange("alice");
      }}
    >
      Select account
    </button>
  ),
}));

vi.mock("@/components/home/PersonalCardPanels/TimeControlSelector", () => ({
  default: ({ onTimeControlChange }: { onTimeControlChange: (value: string) => void }) => (
    <button onClick={() => onTimeControlChange("blitz")}>Select blitz</button>
  ),
}));

const game = (
  isPlayerWhite: boolean,
  result: StatsData["result"],
  timeControl = "180",
): StatsData => ({
  date: "2026-01-15",
  is_player_white: isPlayerWhite,
  player_elo: 1500,
  result,
  time_control: timeControl,
});

const container = document.createElement("div");
document.body.append(container);
let root = createRoot(container);

afterEach(() => {
  act(() => root.unmount());
  root = createRoot(container);
});

function render(info: PlayerGameInfo) {
  act(() => root.render(<OverviewPanel playerName="alice" info={info} />));
}

function selectColor(value: string) {
  const select = container.querySelector<HTMLSelectElement>(
    'select[aria-label="Home.Personal.Color"]',
  )!;
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function expectStats(won: number, draw: number, lost: number, monthlyCount = won + draw + lost) {
  expect(container.textContent).toContain(`Home.Personal.GameCount: ${won + draw + lost}`);
  expect(JSON.parse(container.querySelector('[data-testid="results"]')!.textContent!)).toEqual({
    won,
    draw,
    lost,
  });
  expect(JSON.parse(container.querySelector('[data-testid="activity"]')!.textContent!)).toEqual([
    { name: "2026-01", count: monthlyCount },
  ]);
}

test("color filters general results but preserves monthly activity, and restores both colors", () => {
  render({
    site_stats_data: [
      {
        site: "Chess.com",
        player: "alice",
        data: [
          game(true, "Won"),
          game(true, "Won"),
          game(true, "Lost"),
          game(false, "Won"),
          game(false, "Drawn"),
          game(false, "Lost"),
        ],
      },
    ],
  });
  expectStats(3, 1, 2);
  selectColor("white");
  expectStats(2, 0, 1, 6);
  expect(container.textContent).toContain("66.7%");
  selectColor("black");
  expectStats(1, 1, 1, 6);
  selectColor("all");
  expectStats(3, 1, 2);
});

test("color combines with website, account and time control filters", () => {
  render({
    site_stats_data: [
      {
        site: "Chess.com",
        player: "alice",
        data: [game(true, "Won"), game(false, "Lost"), game(true, "Lost", "600")],
      },
      { site: "Chess.com", player: "bob", data: [game(true, "Lost")] },
      { site: "Lichess", player: "alice", data: [game(true, "Lost")] },
    ],
  });
  act(() => container.querySelector<HTMLButtonElement>("button")!.click());
  act(() =>
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Select blitz")!
      .click(),
  );
  selectColor("white");
  expectStats(1, 0, 0, 2);
  selectColor("black");
  expectStats(0, 0, 1, 2);
  expect(container.textContent).toContain("100.0%");
});

test("a color with no games displays the empty state", () => {
  render({ site_stats_data: [{ site: "Chess.com", player: "alice", data: [game(true, "Won")] }] });
  selectColor("black");
  expect(container.textContent).toContain("Home.Personal.GameCount: 0");
  expect(container.textContent).toContain("Home.Personal.NoGames");
  expect(container.querySelector('[data-testid="results"]')).toBeNull();
  expect(JSON.parse(container.querySelector('[data-testid="activity"]')!.textContent!)).toEqual([
    { name: "2026-01", count: 1 },
  ]);
});

test("monthly activity preserves every month, including gaps and the latest month", () => {
  render({
    site_stats_data: [
      {
        site: "Chess.com",
        player: "alice",
        data: [
          "2026-05-01",
          "2026-06-30",
          "2026-08-01",
          "2026-09-15",
          "2026-10-31",
          "2026-11-09",
        ].map((date) => ({ ...game(true, "Won"), date })),
      },
    ],
  });
  const expected = [
    { name: "2026-05", count: 1 },
    { name: "2026-06", count: 1 },
    { name: "2026-07", count: 0 },
    { name: "2026-08", count: 1 },
    { name: "2026-09", count: 1 },
    { name: "2026-10", count: 1 },
    { name: "2026-11", count: 1 },
  ];
  expect(JSON.parse(container.querySelector('[data-testid="activity"]')!.textContent!)).toEqual(
    expected,
  );
  selectColor("black");
  expect(JSON.parse(container.querySelector('[data-testid="activity"]')!.textContent!)).toEqual(
    expected,
  );
});

test("the summary bar displays percentages without changing other result bars", async () => {
  const { default: ResultsChart } = await vi.importActual<
    typeof import("@/components/home/PersonalCardPanels/ResultsChart")
  >("@/components/home/PersonalCardPanels/ResultsChart");
  act(() => root.render(<ResultsChart won={24} draw={0} lost={20} size="2rem" showLabels />));
  expect(container.textContent).toBe("54.5%45.5%");
  expect(container.querySelector('[data-color="green"]')).not.toBeNull();
  expect(container.querySelector('[data-color="red"]')).not.toBeNull();
  act(() => root.render(<ResultsChart won={1} draw={0} lost={99} size="2rem" showLabels />));
  expect(container.textContent).toBe("99.0%");
  act(() => root.render(<ResultsChart won={24} draw={0} lost={20} size="1rem" />));
  expect(container.textContent).toBe("");
  expect(container.querySelector('[data-color="teal.5"]')).not.toBeNull();
  expect(container.querySelector('[data-color="red.4"]')).not.toBeNull();
});
