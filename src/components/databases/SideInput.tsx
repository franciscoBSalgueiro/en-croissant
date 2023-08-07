import { Box, createStyles, Menu, UnstyledButton } from "@mantine/core";
import { useEffect, useState } from "react";
import { Sides } from "@/utils/db";

const data = [
  { label: "White", color: "white" },
  { label: "Black", color: "black" },
  { label: "Any", color: "gray" },
];

const useStyles = createStyles((theme, { opened }: { opened: boolean }) => ({
  control: {
    display: "flex",
    alignItems: "center",
    padding: "8px 15px 8px 15px",
    borderRadius: theme.radius.md,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    border: `1px solid ${
      theme.colorScheme === "dark" ? theme.colors.dark[4] : theme.colors.gray[2]
    }`,
    transition: "background-color 150ms ease",
    backgroundColor:
      theme.colorScheme === "dark"
        ? theme.colors.dark[opened ? 5 : 6]
        : opened
        ? theme.colors.gray[0]
        : theme.white,

    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[5]
          : theme.colors.gray[0],
    },
  },

  label: {
    fontWeight: 500,
    fontSize: theme.fontSizes.sm,
  },

  icon: {
    transition: "transform 150ms ease",
    transform: opened ? "rotate(180deg)" : "rotate(0deg)",
  },
}));

export function SideInput({
  label,
  sides,
  setSides,
}: {
  label: string;
  sides: Sides;
  setSides: (val: Sides) => void;
}) {
  const [opened, setOpened] = useState(false);
  const { classes } = useStyles({ opened });
  const [selected, setSelected] = useState(
    (sides === "WhiteBlack" && label === "Player") ||
      (sides === "BlackWhite" && label === "Opponent")
      ? data[0]
      : sides === "Any"
      ? data[2]
      : data[1]
  );
  const items = data.map((item) => (
    <Menu.Item
      icon={
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            display: "inline-block",
            backgroundColor: item.color,
          }}
        />
      }
      onClick={() => setSelected(item)}
      key={item.label}
    >
      {item.label}
    </Menu.Item>
  ));

  useEffect(() => {
    if (
      (selected.label === "White" && label === "Player") ||
      (selected.label === "Black" && label === "Opponent")
    ) {
      setSides("WhiteBlack");
    } else if (selected.label === "Any") {
      setSides("Any");
    } else {
      setSides("BlackWhite");
    }
  }, [selected]);

  useEffect(() => {
    const newSelected =
      (sides === "WhiteBlack" && label === "Player") ||
      (sides === "BlackWhite" && label === "Opponent")
        ? data[0]
        : sides === "Any"
        ? data[2]
        : data[1];
    setSelected(newSelected);
  }, [sides]);

  return (
    <Menu onOpen={() => setOpened(true)} onClose={() => setOpened(false)}>
      <Menu.Target>
        <UnstyledButton className={classes.control}>
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              display: "inline-block",
              backgroundColor: selected.color,
            }}
          />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>{items}</Menu.Dropdown>
    </Menu>
  );
}
