import { Autocomplete } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { type ReactNode, useEffect, useState } from "react";
import type { Player } from "@/bindings";
import { query_players } from "@/utils/db";

export function PlayerSearchInput({
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
  const [suggestions, setSuggestions] = useState<{
    file: string;
    players: Player[];
  }>();
  const name = value ?? "";
  const data = suggestions?.file === file && name.trim().length > 0 ? suggestions.players : [];

  function handleChange(val: string) {
    setValue(val.trim().length === 0 ? undefined : val);
  }

  useEffect(() => {
    let active = true;

    const timeout = setTimeout(() => {
      if (name.trim().length === 0) return;

      void query_players(file, {
        name,
        options: {
          page: 1,
          pageSize: 5,
          skipCount: true,
          sort: "elo",
          direction: "desc",
        },
      })
        .then((res) => {
          if (active) setSuggestions({ file, players: res.data });
        })
        .catch(() => {
          if (active) setSuggestions({ file, players: [] });
        });
    }, 100);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [file, name]);
  return (
    <Autocomplete
      comboboxProps={{ withinPortal }}
      aria-label={label}
      value={name}
      data={data.map((player) => player.name!)}
      filter={({ options }) => options}
      onChange={handleChange}
      rightSection={rightSection}
      rightSectionWidth={rightSection ? 36 : undefined}
      rightSectionProps={{ style: { zIndex: "auto" } }}
      leftSection={<IconSearch size="1rem" />}
      placeholder={label}
    />
  );
}
