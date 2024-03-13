import {
  faChess,
  faChessBoard,
  faFileImport,
  faPuzzlePiece,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Button, Card, SimpleGrid, Stack, Text } from "@mantine/core";

import { tabsAtom } from "@/atoms/atoms";
import type { Tab } from "@/utils/tabs";
import { useAtom } from "jotai";
import { useState } from "react";
import ImportModal from "./ImportModal";

export default function NewTabHome({ id }: { id: string }) {
  const [openModal, setOpenModal] = useState(false);
  const [, setTabs] = useAtom(tabsAtom);

  const cards = [
    {
      icon: faChess,
      title: "Play Chess",
      description: "Play against an engine or a friend",
      label: "Play",
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
      icon: faChessBoard,
      title: "Analysis Board",
      description: "Analyze a game or position",
      label: "Open",
      onClick: () => {
        setTabs((prev: Tab[]) => {
          const tab = prev.find((t) => t.value === id);
          if (!tab) return prev;
          tab.name = "Analysis Board";
          tab.type = "analysis";
          return [...prev];
        });
      },
    },
    {
      icon: faFileImport,
      title: "Import Game",
      description: "Import a game from a PGN",
      label: "Import",
      onClick: () => {
        setOpenModal(true);
      },
    },
    {
      icon: faPuzzlePiece,
      title: "Puzzles",
      description: "Train your chess skills",
      label: "Train",
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
              <FontAwesomeIcon icon={card.icon} size="4x" />

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
