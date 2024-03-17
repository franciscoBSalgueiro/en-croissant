import type { Sides } from "@/utils/db";
import { Box, Menu, UnstyledButton } from "@mantine/core";
import { useEffect, useState } from "react";
import * as classes from "./SideInput.css";

const data = [
  { label: "White", color: "white" },
  { label: "Black", color: "black" },
  { label: "Any", color: "gray" },
];

export function SideInput({
  label,
  sides,
  setSides,
}: {
  label: string;
  sides: Sides;
  setSides: (val: Sides) => void;
}) {
  const [selected, setSelected] = useState(
    (sides === "WhiteBlack" && label === "Player") ||
      (sides === "BlackWhite" && label === "Opponent")
      ? data[0]
      : sides === "Any"
        ? data[2]
        : data[1],
  );
  const items = data.map((item) => (
    <Menu.Item
      leftSection={
        <Box
          style={{
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
    <Menu>
      <Menu.Target>
        <UnstyledButton className={classes.control}>
          <Box
            style={{
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
