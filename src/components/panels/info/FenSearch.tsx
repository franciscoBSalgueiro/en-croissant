import { commands } from "@/bindings";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { chessopsError } from "@/utils/chessops";
import {
  Combobox,
  Group,
  InputBase,
  Loader,
  ScrollArea,
  Text,
  useCombobox,
} from "@mantine/core";
import { type FenError, parseFen } from "chessops/fen";
import { useContext, useEffect, useRef, useState } from "react";
import useSWRImmutable from "swr/immutable";
import { useStore } from "zustand";

export default function FenSearch({ currentFen }: { currentFen: string }) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [error, setError] = useState<FenError | undefined>(undefined);
  const store = useContext(TreeStateContext)!;
  const headers = useStore(store, (s) => s.headers);
  const setHeaders = useStore(store, (s) => s.setHeaders);

  function addFen(fen: string, chess960: boolean) {
    if (fen) {
      const res = parseFen(fen);
      if (res.isErr) {
        setError(res.error);
      } else {
        setHeaders({
          ...headers,
          fen,
          variant: chess960 ? "Chess960" : undefined,
        });
        setError(undefined);
      }
    }
    return fen;
  }

  const [value, setValue] = useState<string | null>(null);
  const [search, setSearch] = useState(currentFen);

  useEffect(() => {
    setValue(currentFen);
    setSearch(currentFen);
  }, [currentFen]);

  const { data, isLoading } = useSWRImmutable(
    ["search_opening_name", search],
    async ([, search]) => {
      const res = await commands.searchOpeningName(search);
      if (res.status === "ok") {
        return res.data;
      }
      throw new Error(res.error);
    },
  );

  const exactOptionMatch = data?.some((item) => item.fen === search);

  const options = data?.map((item) => (
    <Combobox.Option value={item.fen} key={item.fen}>
      <Group wrap="nowrap">
        <div>
          <Text size="sm">{item.name}</Text>
          <Text size="xs" opacity={0.65}>
            {item.fen}
          </Text>
        </div>
      </Group>
    </Combobox.Option>
  ));

  const prev = useRef<string | null>(null);

  return (
    <Combobox
      store={combobox}
      withinPortal={true}
      onOptionSubmit={(val) => {
        if (val === "$create") {
          addFen(search, data?.some((item) => item.fen === search) || false);
          setValue(search);
        } else {
          addFen(val, data?.some((item) => item.fen === val) || false);
          setValue(val);
          setSearch(val);
        }

        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          error={error && chessopsError(error)}
          rightSection={isLoading && <Loader size={18} />}
          value={search}
          onChange={(event) => {
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
            setSearch(event.currentTarget.value);
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => {
            combobox.closeDropdown();
            setSearch(value || "");
          }}
          onKeyDown={(event) => {
            if (
              (event.nativeEvent.code === "Enter" ||
                event.nativeEvent.code === "NumpadEnter") &&
              prev.current !== "ArrowDown" &&
              prev.current !== "ArrowUp"
            ) {
              addFen(
                search,
                data?.some((item) => item.fen === search) || false,
              );
              combobox.closeDropdown();
            }
            prev.current = event.nativeEvent.code;
          }}
          placeholder="Enter FEN"
          rightSectionPointerEvents="none"
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize mah={200} type="scroll">
            {options}
            {!exactOptionMatch && search.trim().length > 0 && (
              <Combobox.Option value="$create">{search}</Combobox.Option>
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
