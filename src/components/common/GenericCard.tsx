import { Box, Stack, Text } from "@mantine/core";
import cx from "clsx";
import type { ReactNode } from "react";
import * as classes from "./GenericCard.css";

type Props<T> = {
  id: T;
  isSelected: boolean;
  setSelected: (id: T) => void;
  error?: string;
  stats?: {
    label: string;
    value: string;
  }[];
  Header: ReactNode;
  onDoubleClick?: () => void;
};

export default function GenericCard<T>({
  id,
  isSelected,
  setSelected,
  error,
  stats,
  Header,
  onDoubleClick,
}: Props<T>) {
  return (
    <Box
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") setSelected(id);
      }}
      className={cx(classes.card, {
        [classes.selected]: isSelected,
        [classes.error]: !!error,
      })}
      onClick={() => setSelected(id)}
      onDoubleClick={onDoubleClick}
    >
      <Stack h="100%" justify="space-between">
        {Header}

        {stats && (
          <div className={classes.info}>
            {stats.map((stat) => (
              <div key={stat.label}>
                <Text
                  size="xs"
                  c="dimmed"
                  fw="bold"
                  className={classes.label}
                  mt="1rem"
                >
                  {stat.label}
                </Text>
                <Text fw={700} size="lg" style={{ lineHeight: 1 }}>
                  {stat.value}
                </Text>
              </div>
            ))}
          </div>
        )}
      </Stack>
    </Box>
  );
}
