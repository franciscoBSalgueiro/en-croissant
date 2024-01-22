import { Player, Sides, query_players } from "@/utils/db";
import { Autocomplete } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { SideInput } from "./SideInput";

export function SearchInput({
  label,
  file,
  sides,
  setSides,
  setValue,
}: {
  label: string;
  file: string;
  sides: Sides;
  setSides: (val: Sides) => void;
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
      rightSection={
        <SideInput sides={sides} setSides={setSides} label={label} />
      }
      leftSection={<IconSearch size="1rem" />}
      placeholder={label}
    />
  );
}
