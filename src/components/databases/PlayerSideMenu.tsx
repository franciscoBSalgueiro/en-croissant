import { Box, Menu, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { PlayerSide } from "@/bindings";
import classes from "./SideInput.module.css";

/** Avoid two "white" or two "black" selections; adjusts the non-edited slot to "any" when needed. */
export function resolveMutualPlayerSides(
  which: 1 | 2,
  side: PlayerSide,
  player1Side: PlayerSide,
  player2Side: PlayerSide,
): { player1Side: PlayerSide; player2Side: PlayerSide } {
  if (which === 1) {
    let p2 = player2Side;
    if (side === "white" && p2 === "white") p2 = "any";
    if (side === "black" && p2 === "black") p2 = "any";
    return { player1Side: side, player2Side: p2 };
  }
  let p1 = player1Side;
  if (side === "white" && p1 === "white") p1 = "any";
  if (side === "black" && p1 === "black") p1 = "any";
  return { player1Side: p1, player2Side: side };
}

export function PlayerSideMenu({
  value,
  onChange,
}: {
  value: PlayerSide;
  onChange: (side: PlayerSide) => void;
}) {
  const { t } = useTranslation();
  const items: { side: PlayerSide; label: string; color: string }[] = [
    { side: "white", label: t("Fen.White"), color: "white" },
    { side: "black", label: t("Fen.Black"), color: "black" },
    { side: "any", label: t("Board.Database.Local.Result.Any"), color: "gray" },
  ];
  const selected = items.find((i) => i.side === value) ?? items[2]!;

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
      <Menu.Dropdown>
        {items.map((item) => (
          <Menu.Item
            key={item.side}
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
            onClick={() => onChange(item.side)}
          >
            {item.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
