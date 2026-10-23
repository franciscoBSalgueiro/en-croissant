import { Tabs } from "@mantine/core";
import { useTranslation } from "react-i18next";
import classes from "../PersonalCard.module.css";

export enum DateRange {
  SevenDays = "7d",
  ThirtyDays = "30d",
  NinetyDays = "90d",
  OneYear = "1y",
  AllTime = "all",
}

interface DateRangeTabsProps {
  timeRange: string | null;
  onTimeRangeChange: (value: string | null) => void;
}

const DateRangeTabs = ({ timeRange, onTimeRangeChange }: DateRangeTabsProps) => {
  const { t } = useTranslation();
  const timeRanges = [
    { value: DateRange.SevenDays, label: t("Home.Personal.Days", { count: 7 }) },
    { value: DateRange.ThirtyDays, label: t("Home.Personal.Days", { count: 30 }) },
    { value: DateRange.NinetyDays, label: t("Home.Personal.Days", { count: 90 }) },
    { value: DateRange.OneYear, label: t("Home.Personal.OneYear") },
    { value: DateRange.AllTime, label: t("Home.Personal.AllTime") },
  ];
  return (
    <Tabs
      variant="pills"
      value={timeRange}
      onChange={onTimeRangeChange}
      classNames={{ tab: classes.dateRangeTab }}
    >
      <Tabs.List
        style={{
          display: "flex",
          justifyContent: "flex-start",
          width: "100%",
        }}
      >
        {timeRanges.map((range) => (
          <Tabs.Tab key={range.value} value={range.value}>
            {range.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
};

export default DateRangeTabs;
