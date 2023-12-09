import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import {
  Combobox,
  Group,
  InputBase,
  Loader,
  ScrollArea,
  Text,
  useCombobox,
} from "@mantine/core";
import { invoke } from "@/utils/invoke";
import { useState, useContext, useEffect, useRef } from "react";
import { FenError, parseFen } from "chessops/fen";
import { chessopsError } from "@/utils/chessops";
import useSWRImmutable from "swr/immutable";

export default function FenSearch({ currentFen }: { currentFen: string }) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [error, setError] = useState<FenError | undefined>(undefined);
  const dispatch = useContext(TreeDispatchContext);

  function addFen(fen: string) {
    if (fen) {
      const res = parseFen(fen);
      if (res.isErr) {
        setError(res.error);
      } else {
        dispatch({ type: "SET_FEN", payload: fen });
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
    ([, search]) =>
      invoke<
        {
          eco: string;
          name: string;
          fen: string;
        }[]
      >("search_opening_name", { query: search })
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
        console.log(val);
        if (val === "$create") {
          addFen(search);
          setValue(search);
        } else {
          addFen(val);
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
              event.nativeEvent.code === "Enter" &&
              prev.current !== "ArrowDown" &&
              prev.current !== "ArrowUp"
            ) {
              addFen(search);
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
