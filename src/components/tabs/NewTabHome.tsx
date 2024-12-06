import { Box, Button, Card, SimpleGrid, Stack, Text } from "@mantine/core";

import { tabsAtom } from "@/state/atoms";
import type { Tab } from "@/utils/tabs";
import { useAtom } from "jotai";
import { useState } from "react";
import ImportModal from "./ImportModal";

import { IconChess, IconFileImport, IconPuzzle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import Chessboard from "../icons/Chessboard";

export default function NewTabHome({ id }: { id: string }) {
  const { t } = useTranslation();

  const [openModal, setOpenModal] = useState(false);
  const [, setTabs] = useAtom(tabsAtom);

  const cards = [
    {
      icon: <IconChess size={60} />,
      title: t("Home.Card.PlayChess.Title"),
      description: t("Home.Card.PlayChess.Desc"),
      label: t("Home.Card.PlayChess.Button"),
      onClick: () => {
        setTabs((prev: Tab[]) => {
          const tab = prev.find((t) => t.value === id);
          if (!tab) return prev;
          tab.name = "New Game";
          tab.type = "play";
          return [...prev];
        });
      },
    },
    {
      icon: <Chessboard size={60} />,
      title: t("Home.Card.AnalysisBoard.Title"),
      description: t("Home.Card.AnalysisBoard.Desc"),
      label: t("Home.Card.AnalysisBoard.Button"),
      onClick: () => {
        setTabs((prev: Tab[]) => {
          const tab = prev.find((t) => t.value === id);
          if (!tab) return prev;
          tab.name = t("Home.Card.AnalysisBoard.Title");
          tab.type = "analysis";
          return [...prev];
        });
      },
    },
    {
      icon: <IconFileImport size={60} />,
      title: t("Home.Card.ImportGame.Title"),
      description: t("Home.Card.ImportGame.Desc"),
      label: t("Home.Card.ImportGame.Button"),
      onClick: () => {
        setOpenModal(true);
      },
    },
    {
      icon: <IconPuzzle size={60} />,
      title: t("Home.Card.Puzzle.Title"),
      description: t("Home.Card.Puzzle.Desc"),
      label: t("Home.Card.Puzzle.Button"),
      onClick: () => {
        setTabs((prev) => {
          const tab = prev.find((t) => t.value === id);
          if (!tab) return prev;
          tab.name = "Puzzle Training";
          tab.type = "puzzles";
          return [...prev];
        });
      },
    },
  ];

  return (
    <>
      <ImportModal openModal={openModal} setOpenModal={setOpenModal} />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {cards.map((card) => (
          <Card shadow="sm" p="lg" radius="md" withBorder key={card.title}>
            <Stack align="center" h="100%" justify="space-between">
              {card.icon}

              <Box style={{ textAlign: "center" }}>
                <Text fw={500}>{card.title}</Text>
                <Text size="sm" c="dimmed">
                  {card.description}
                </Text>
              </Box>

              <Button
                variant="light"
                fullWidth
                mt="md"
                radius="md"
                onClick={card.onClick}
              >
                {card.label}
              </Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </>
  );
}
