import { Autocomplete } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import type { Event } from "@/bindings";
import { query_tournaments } from "@/utils/db";

export function EventSearchInput({
  label,
  value,
  file,
  rightSection,
  withinPortal = true,
  setValue,
}: {
  label: string;
  value?: string;
  file: string;
  rightSection?: ReactNode;
  withinPortal?: boolean;
  setValue: (val: string | undefined) => void;
}) {
  const [data, setData] = useState<Event[]>([]);

  async function handleChange(val: string) {
    setValue(val.trim().length === 0 ? undefined : val);

    if (val.trim().length === 0) {
      setData([]);
      return;
    }

    const res = await query_tournaments(file, {
      name: val,
      options: {
        page: 1,
        pageSize: 5,
        skipCount: true,
        sort: "games_count",
        direction: "desc",
      },
    });
    setData(res.data);
  }
  return (
    <Autocomplete
      comboboxProps={{ withinPortal }}
      aria-label={label}
      value={value ?? ""}
      data={data.map((event) => event.name!)}
      filter={({ options }) => options}
      onChange={handleChange}
      rightSection={rightSection}
      leftSection={<IconSearch size="1rem" />}
      placeholder={label}
    />
  );
}
