import { TreeDispatchContext } from "@/components/common/TreeStateContext";
import { Group, Select, Text } from "@mantine/core";
import { invoke } from "@/utils/invoke";
import { useState, useContext, forwardRef, useEffect } from "react";
import { FenError, parseFen } from "chessops/fen";
import { chessopsError } from "@/utils/chessops";

type ItemProps = {
  label: string;
  value: string;
  group?: string;
};

export default function FenSearch({ currentFen }: { currentFen: string }) {
  const [data, setData] = useState<ItemProps[]>([
    { label: currentFen, value: currentFen },
  ]);
  const [error, setError] = useState<FenError | undefined>(undefined);
  const dispatch = useContext(TreeDispatchContext);

  useEffect(() => {
    setData([{ label: currentFen, value: currentFen }]);
  }, [currentFen]);

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
      error={error ? chessopsError(error) : undefined}
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
