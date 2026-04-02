import { Autocomplete } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import type { Player } from "@/bindings";
import { query_players } from "@/utils/db";

export function PlayerSearchInput({
  label,
  value,
  file,
  rightSection,
  setValue,
}: {
  label: string;
  value?: string;
  file: string;
  rightSection?: ReactNode;
  setValue: (val: string | undefined) => void;
}) {
  const [data, setData] = useState<Player[]>([]);

  async function handleChange(val: string) {
    setValue(val.trim().length === 0 ? undefined : val);

    if (val.trim().length === 0) {
      setData([]);
      return;
    }

    const res = await query_players(file, {
      name: val,
      options: {
        page: 1,
        pageSize: 5,
        skipCount: true,
        sort: "elo",
        direction: "desc",
      },
    });
    setData(res.data);
  }
  return (
    <Autocomplete
      value={value ?? ""}
      data={data.map((player) => player.name!)}
      onChange={handleChange}
      rightSection={rightSection}
      leftSection={<IconSearch size="1rem" />}
      placeholder={label}
    />
  );
}
