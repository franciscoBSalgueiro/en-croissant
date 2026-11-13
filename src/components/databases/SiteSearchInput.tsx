import { Autocomplete } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { commands } from "@/bindings";

export function SiteSearchInput({
  label, value, file, setValue,
}: {
  label: string;
  value?: string;
  file: string;
  setValue: (value: string | undefined) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const name = value ?? "";
  useEffect(() => {
    let active = true;
    if (!name.trim()) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const result = await commands.getSites(file, name);
        if (active) setSuggestions(result.status === "ok" ? result.data : []);
      } catch {
        if (active) setSuggestions([]);
      }
    }, 100);
    return () => { active = false; clearTimeout(timeout); };
  }, [file, name]);

  return (
    <Autocomplete
      aria-label={label}
      value={name}
      data={suggestions}
      filter={({ options }) => options}
      onChange={(val) => setValue(val.trim() ? val : undefined)}
      leftSection={<IconSearch size="1rem" />}
      placeholder={label}
    />
  );
}
