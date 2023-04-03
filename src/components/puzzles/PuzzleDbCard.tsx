import { Group, Text } from "@mantine/core";
import { IconDatabase } from "@tabler/icons-react";
import { formatBytes, formatNumber } from "../../utils/format";
import GenericCard from "../common/GenericCard";

interface PuzzleCardProps {
  id: number;
  isSelected: boolean;
  setSelected: React.Dispatch<React.SetStateAction<number | null>>;
  title: string;
  puzzles: number;
  storage: number;
}

export function PuzzleDbCard({
  id,
  isSelected,
  setSelected,
  title,
  puzzles,
  storage,
}: PuzzleCardProps) {
  return (
    <GenericCard
      id={id}
      isSelected={isSelected}
      setSelected={setSelected}
      Header={
        <Group noWrap>
          <IconDatabase size={24} />
          <div>
            <Text weight={500}>{title}</Text>
          </div>
        </Group>
      }
      stats={[
        {
          label: "Puzzles",
          value: formatNumber(puzzles),
        },
        {
          label: "Storage",
          value: formatBytes(storage),
        },
      ]}
    />
  );
}
