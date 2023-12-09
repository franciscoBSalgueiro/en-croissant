import { Box, Stack, Text } from "@mantine/core";
import { ReactNode } from "react";
import * as classes from "./GenericCard.css";
import cx from "clsx";

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
};

export default function GenericCard<T>({
  id,
  isSelected,
  setSelected,
  error,
  stats,
  Header,
}: Props<T>) {
  return (
    <>
      <Box
        className={cx(classes.card, {
          [classes.selected]: isSelected,
          [classes.error]: !!error,
        })}
        onClick={() => setSelected(id)}
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
    </>
  );
}
