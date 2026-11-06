import { Box, Menu, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { Sides } from "@/utils/db";
import classes from "./SideInput.module.css";

export function SideInput({
  label,
  player,
  sides,
  setSides,
}: {
  label: string;
  player: 1 | 2;
  sides: Sides;
  setSides: (val: Sides) => void;
}) {
  const { t } = useTranslation();
  const data = [
    { label: t("Fen.White"), color: "white", sides: player === 1 ? "WhiteBlack" : "BlackWhite" },
    { label: t("Fen.Black"), color: "black", sides: player === 1 ? "BlackWhite" : "WhiteBlack" },
    { label: t("Board.Database.Local.Result.Any"), color: "gray", sides: "Any" },
  ] as const;
  const selected =
    (sides === "WhiteBlack" && player === 1) || (sides === "BlackWhite" && player === 2)
      ? data[0]
      : sides === "Any"
        ? data[2]
        : data[1];
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
      onClick={() => setSides(item.sides)}
      key={item.label}
    >
      {item.label}
    </Menu.Item>
  ));

  return (
    <Menu withinPortal={false}>
      <Menu.Target>
        <UnstyledButton
          className={classes.control}
          aria-label={`${label}: ${selected.label}`}
          title={`${label}: ${selected.label}`}
        >
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
