import { Player, query_players } from "@/utils/db";
import { Autocomplete } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { ReactNode, useState } from "react";

export function PlayerSearchInput({
  label,
  file,
  rightSection,
  setValue,
}: {
  label: string;
  file: string;
  rightSection?: ReactNode;
  setValue: (val: number | undefined) => void;
}) {
  const [tempValue, setTempValue] = useState("");
  const [data, setData] = useState<Player[]>([]);

  async function handleChange(val: string) {
    setTempValue(val);
    if (val.trim().length === 0) {
      setValue(undefined);
      setData([]);
      return;
    }
    const player = data.find((player) => player.name === val);
    if (player) {
      setValue(player.id);
    }

    const res = await query_players(file, {
      page: 1,
      pageSize: 5,
      name: val,
      skip_count: true,
      sort: "elo",
      direction: "asc",
    });
    setData(res.data);
  }
  return (
    <Autocomplete
      value={tempValue}
      data={data.map((player) => player.name)}
      onChange={handleChange}
      rightSection={rightSection}
      leftSection={<IconSearch size="1rem" />}
      placeholder={label}
    />
  );
}
