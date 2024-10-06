import { type Player, commands } from "@/bindings";
import { query_players } from "@/utils/db";
import { unwrap } from "@/utils/unwrap";
import { Autocomplete } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { type ReactNode, useEffect, useState } from "react";

export function PlayerSearchInput({
  label,
  value,
  file,
  rightSection,
  setValue,
}: {
  label: string;
  value?: number;
  file: string;
  rightSection?: ReactNode;
  setValue: (val: number | undefined) => void;
}) {
  const [tempValue, setTempValue] = useState("");
  const [data, setData] = useState<Player[]>([]);

  useEffect(() => {
    if (value !== undefined) {
      commands.getPlayer(file, value).then((res) => {
        const player = unwrap(res);
        if (player?.name) {
          setTempValue(player.name);
        }
      });
    }
  }, [value]);

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
      name: val,
      options: {
        page: 1,
        pageSize: 5,
        skipCount: true,
        sort: "elo",
        direction: "asc",
      },
    });
    setData(res.data);
  }
  return (
    <Autocomplete
      value={tempValue}
      data={data.map((player) => player.name!)}
      onChange={handleChange}
      rightSection={rightSection}
      leftSection={<IconSearch size="1rem" />}
      placeholder={label}
    />
  );
}
