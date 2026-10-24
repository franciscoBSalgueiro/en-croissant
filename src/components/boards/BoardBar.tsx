import { Group, Text } from "@mantine/core";
import type { ReactNode } from "react";

interface BoardBarProps {
  name: string;
  rating?: string | number | null;
  onNameClick: () => void;
  height: string;
  children?: ReactNode;
}

export function BoardBar({ name, rating, onNameClick, height, children }: BoardBarProps) {
  return (
    <Group
      ml="2.5rem"
      mr="xs"
      h={height}
      justify="space-between"
      wrap="nowrap"
      align="flex-end"
      style={{ flexShrink: 0 }}
    >
      <Group gap={6} align="baseline" style={{ minWidth: 0, flexShrink: 1 }}>
        <Text fw="bold" size="md" truncate style={{ cursor: "pointer" }} onClick={onNameClick}>
          {name !== "?" && name}
        </Text>
        {rating && (
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            ({rating})
          </Text>
        )}
      </Group>

      <Group align="flex-end" wrap="nowrap" style={{ flexShrink: 0 }}>
        {children}
      </Group>
    </Group>
  );
}
