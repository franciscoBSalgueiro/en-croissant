import { Button, Group, SegmentedControl, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconArrowRight, IconBook, IconChess } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { INITIAL_FEN } from "chessops/fen";
import { useAtom, useStore } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  activeTabAtom,
  tabsAtom,
  referenceDbAtom,
  tabFamily,
  currentDbTypeAtom,
  currentDbTabAtom,
  currentLocalOptionsAtom,
} from "@/state/atoms";
import { createTab } from "@/utils/tabs";
import classes from "./OpeningsPanel.module.css";

export interface OpeningSource {
  file: string;
  player: string;
}

function OpeningsPanel({
  playerName,
  openingSources,
}: {
  playerName: string;
  openingSources?: OpeningSource[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const store = useStore();
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);
  const [referenceDatabase, setReferenceDatabase] = useAtom(referenceDbAtom);
  const [color, setColor] = useState<"white" | "black">("white");
  const sources = openingSources ?? [];

  const openDatabaseInTabs = async () => {
    const source = sources.find((source) => source.player === playerName) ?? sources[0];
    const preferredDb = source?.file || referenceDatabase;
    const player = source?.player || playerName;

    if (preferredDb) {
      setReferenceDatabase(preferredDb);
    }

    const tabId = await createTab({
      tab: {
        name: `${playerName} ${color === "white" ? "White" : "Black"} Database`,
        type: "analysis",
      },
      setTabs,
      setActiveTab,
    });

    // Configure the new tab before navigating so the database panel is ready immediately.
    store.set(activeTabAtom, tabId);
    store.set(tabFamily(tabId), "database");
    store.set(currentDbTypeAtom, "local");
    store.set(currentDbTabAtom, "stats");
    store.set(currentLocalOptionsAtom, (prev) => ({
      ...prev,
      path: preferredDb ?? prev.path,
      position: { fen: INITIAL_FEN, type_: "exact" },
      player1: color === "white" ? player : undefined,
      player2: color === "black" ? player : undefined,
      outcome: undefined,
    }));

    void navigate({ to: "/" });
  };

  return (
    <div className={classes.panel}>
      <Stack gap="lg" align="center" className={classes.content}>
        <Stack gap="xs" align="center">
          <Text size="lg" fw={600} ta="center">
            {t("Home.Personal.ExploreOpenings")}
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            {t("Home.Personal.ExploreOpeningsDescription")}
          </Text>
        </Stack>
        <Stack gap="md" w="100%">
          <SegmentedControl
            fullWidth
            value={color}
            onChange={(value) => setColor(value as "white" | "black")}
            data={[
              {
                value: "white",
                label: (
                  <Group gap="xs" justify="center" wrap="nowrap">
                    <span className={classes.whitePiece} aria-hidden="true" />
                    {t("Home.Personal.AsWhite")}
                  </Group>
                ),
              },
              {
                value: "black",
                label: (
                  <Group gap="xs" justify="center" wrap="nowrap">
                    <span className={classes.blackPiece} aria-hidden="true" />
                    {t("Home.Personal.AsBlack")}
                  </Group>
                ),
              },
            ]}
          />
          <Button
            fullWidth
            rightSection={<IconArrowRight size={16} aria-hidden="true" />}
            onClick={openDatabaseInTabs}
          >
            {t("Home.Personal.OpenInAnalysis")}
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}

export default OpeningsPanel;
