import { Group, Text } from "@mantine/core";
import { IconDatabase } from "@tabler/icons-react";
import { formatBytes, formatNumber } from "@/utils/format";
import { PuzzleDatabase } from "@/utils/puzzles";
import GenericCard from "../common/GenericCard";

interface PuzzleCardProps {
  db: PuzzleDatabase;
  isSelected: boolean;
  setSelected: React.Dispatch<React.SetStateAction<string | null>>;
}

export function PuzzleDbCard({ db, isSelected, setSelected }: PuzzleCardProps) {
  return (
    <GenericCard
      id={db.path}
      isSelected={isSelected}
      setSelected={setSelected}
      Header={
        <Group noWrap>
          <IconDatabase size="1.5rem" />
          <div>
            <Text weight={500}>{db.title}</Text>
          </div>
        </Group>
      }
      stats={[
        {
          label: "Puzzles",
          value: formatNumber(db.puzzle_count),
        },
        {
          label: "Storage",
          value: formatBytes(db.storage_size),
        },
      ]}
    />
  );
}
