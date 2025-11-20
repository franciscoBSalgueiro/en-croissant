import { RangeSlider } from "@mantine/core";
import { useEffect, useState } from "react";

interface TimeRangeSliderProps {
  ratingDates: number[];
  dateRange?: { start: number; end: number };
  onDateRangeChange: (range: { start: number; end: number }) => void;
}

const TimeRangeSlider = ({
  ratingDates,
  dateRange,
  onDateRangeChange,
}: TimeRangeSliderProps) => {
  const [internalRange, setInternalRange] = useState<[number, number]>([
    dateRange?.start ?? 0,
    (dateRange?.end ?? ratingDates.length > 0) ? ratingDates.length - 1 : 0,
  ]);

  useEffect(() => {
    if (dateRange) {
      setInternalRange([dateRange.start, dateRange.end]);
    }
  }, [dateRange]);

  return (
    <RangeSlider
      pt="lg"
      label={(value) => new Date(ratingDates[value]).toLocaleDateString()}
      value={internalRange}
      onChange={(value) => {
        setInternalRange(value);
        onDateRangeChange({ start: value[0], end: value[1] });
      }}
      min={0}
      max={ratingDates.length - 1 > 0 ? ratingDates.length - 1 : 0}
      step={1}
      minRange={2}
      styles={{
        root: {
          paddingLeft: "4rem",
          paddingRight: "1rem",
        },
      }}
    />
  );
};

export default TimeRangeSlider;
