import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { capitalize } from "@/utils/format";
import { Group, Select, Text } from "@mantine/core";
import { invoke } from "@/utils/invoke";
import { useState, useContext, forwardRef } from "react";

type ItemProps = {
  label: string;
  value: string;
  group?: string;
};

export default function FenSearch({ currentFen }: { currentFen: string }) {
  const [data, setData] = useState<ItemProps[]>([
    { label: currentFen, value: currentFen },
  ]);
  const [error, setError] = useState<string | undefined>(undefined);
  const dispatch = useContext(TreeDispatchContext);

  function addFen(fen: string) {
    if (fen) {
      invoke<{ valid: boolean; error?: string }>("validate_fen", {
        fen,
      }).then((v) => {
        if (v.valid) {
          dispatch({ type: "SET_FEN", payload: fen });
          setError(undefined);
        } else if (v.error) {
          setError(capitalize(v.error));
        }
      });
    }
    return fen;
  }

  async function searchOpening(name: string) {
    const results = await invoke<
      {
        eco: string;
        name: string;
        fen: string;
      }[]
    >("search_opening_name", {
      query: name,
    });
    setData([
      {
        label: name,
        value: name,
      },
      ...results.map((p) => ({
        label: p.name,
        value: p.fen,
      })),
    ]);
  }

  return (
    <Select
      placeholder="Enter FEN"
      value={currentFen}
      data={data}
      error={error}
      itemComponent={SelectItem}
      dropdownPosition="bottom"
      onChange={addFen}
      onCreate={addFen}
      filter={() => true}
      getCreateLabel={(fen) => {
        searchOpening(fen);
        return null;
      }}
      searchable
      creatable
    />
  );
}

const SelectItem = forwardRef<HTMLDivElement, ItemProps>(function SelectItem(
  { label, value: fen, ...others }: ItemProps,
  ref
) {
  return (
    <div ref={ref} {...others} key={label}>
      <Group noWrap>
        <div>
          <Text size="sm">{label}</Text>
          <Text size="xs" opacity={0.65}>
            {fen}
          </Text>
        </div>
      </Group>
    </div>
  );
});
