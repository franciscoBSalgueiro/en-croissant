import { Autocomplete, Loader } from "@mantine/core";
import { useState } from "react";
import { query_players } from "../utils/db";

export function SearchInput({
  label,
  file,
  value,
  setValue,
}: {
  label: string;
  file: string;
  value: string;
  setValue: (val: string) => void;
}) {
  const [tempValue, setTempValue] = useState(value);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<string[]>([]);

  async function handleChange(val: string) {
    setTempValue(val);
    if (data.includes(val)) {
      setValue(val);
    }
    if (val.trim().length === 0) {
      setValue("");
    }
    setData([]);

    if (val.trim().length === 0) {
      setLoading(false);
    } else {
      setLoading(true);
      const res = await query_players(file, {
        limit: 5,
        offset: 0,
        name: val,
      });
      setLoading(false);
      setData(res.map((game) => game.name));
    }
  }
  return (
    <Autocomplete
      value={tempValue}
      data={data}
      onChange={handleChange}
      rightSection={loading ? <Loader size={16} /> : null}
      label={label}
      placeholder="Player name"
    />
  );
}
