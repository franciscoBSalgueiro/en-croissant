import { RangeSlider } from "@mantine/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface TimeRangeSliderProps {
  ratingDates: number[];
  dateRange?: { start: number; end: number };
  onDateRangeChange: (range: { start: number; end: number }) => void;
}

const TimeRangeSlider = ({ ratingDates, dateRange, onDateRangeChange }: TimeRangeSliderProps) => {
  const { t, i18n } = useTranslation();
  const [internalRange, setInternalRange] = useState<[number, number]>([
    dateRange?.start ?? 0,
    dateRange?.end ?? Math.max(0, ratingDates.length - 1),
  ]);

  return (
    <RangeSlider
      pt="xs"
      pb="xs"
      size="xs"
      color="gray.6"
      thumbSize={12}
      thumbFromLabel={t("Common.StartDate")}
      thumbToLabel={t("Common.EndDate")}
      label={(value) => new Date(ratingDates[value]).toLocaleDateString(i18n.resolvedLanguage)}
      value={dateRange ? [dateRange.start, dateRange.end] : internalRange}
      onChange={(value) => {
        if (!dateRange) setInternalRange(value);
        onDateRangeChange({ start: value[0], end: value[1] });
      }}
      min={0}
      max={ratingDates.length - 1 > 0 ? ratingDates.length - 1 : 0}
      step={1}
      minRange={1}
      styles={{
        thumb: { borderWidth: 1, backgroundColor: "var(--mantine-color-body)" },
        root: {
          paddingLeft: "0.5rem",
          paddingRight: "0.5rem",
        },
      }}
    />
  );
};

export default TimeRangeSlider;
