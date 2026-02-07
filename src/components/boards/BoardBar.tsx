import { Group, Text } from "@mantine/core";
import type { ReactNode } from "react";

interface BoardBarProps {
  name: string;
  rating?: string | number | null;
  onNameClick: () => void;
  height: string;
  children?: ReactNode;
}

export function BoardBar({
  name,
  rating,
  onNameClick,
  height,
  children,
}: BoardBarProps) {
  return (
    <Group
      ml="2.5rem"
      mr="xs"
      h={height}
      justify="space-between"
      wrap="nowrap"
      align="flex-end"
    >
      <Group gap={6} align="baseline">
        <Text
          fw="bold"
          size="md"
          style={{ cursor: "pointer" }}
          onClick={onNameClick}
        >
          {name !== "?" && name}
        </Text>
        {rating && (
          <Text size="xs" c="dimmed">
            ({rating})
          </Text>
        )}
      </Group>

      <Group align="flex-end" wrap="nowrap">
        {children}
      </Group>
    </Group>
  );
}
