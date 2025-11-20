import { Tabs } from "@mantine/core";

export enum DateRange {
  SevenDays = "7d",
  ThirtyDays = "30d",
  NinetyDays = "90d",
  OneYear = "1y",
  AllTime = "all",
}

const DEFAULT_TIME_RANGES = [
  { value: DateRange.SevenDays, label: "7 days" },
  { value: DateRange.ThirtyDays, label: "30 days" },
  { value: DateRange.NinetyDays, label: "90 days" },
  { value: DateRange.OneYear, label: "1 year" },
  { value: DateRange.AllTime, label: "All time" },
];

interface DateRangeTabsProps {
  timeRange: string | null;
  onTimeRangeChange: (value: string | null) => void;
}

const DateRangeTabs = ({
  timeRange,
  onTimeRangeChange,
}: DateRangeTabsProps) => {
  return (
    <Tabs pt="md" value={timeRange} onChange={onTimeRangeChange}>
      <Tabs.List
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
        }}
      >
        {DEFAULT_TIME_RANGES.map((range) => (
          <Tabs.Tab key={range.value} value={range.value}>
            {range.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
};

export default DateRangeTabs;
