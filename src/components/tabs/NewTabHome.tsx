import {
  faChess,
  faChessBoard,
  faFileImport,
  faPuzzlePiece
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Box,
  Button,
  Card,
  Modal,
  SimpleGrid,
  Stack,
  Text
} from "@mantine/core";
import { useState } from "react";

export default function NewTabHome({
  setTabs,
  id,
}: {
  setTabs: (tabs: any) => void;
  id: string;
}) {
  const [openModal, setOpenModal] = useState(false);

  const cards = [
    {
      icon: faChess,
      title: "Play Online",
      description: "Play against other an engine or a friend",
      label: "Play",
      onClick: () => {
        setTabs((prev: any) => {
          const tab = prev.find((t: any) => t.value === id);
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
        setTabs((prev: any) => {
          const tab = prev.find((t: any) => t.value === id);
          tab.name = "Analysis Board";
          tab.type = "analysis";
          return [...prev];
        });
      },
    },
    {
      icon: faFileImport,
      title: "Import Game",
      description: "Import a game from a PGN file",
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
        setTabs((prev: any) => {
          const tab = prev.find((t: any) => t.value === id);
          tab.name = "Puzzle Training";
          tab.type = "puzzles";
          return [...prev];
        });
      },
    },
  ];

  return (
    <>
      <Modal
        opened={openModal}
        onClose={() => setOpenModal(false)}
        title="Import game"
      >
        {/* Modal content */}
      </Modal>
      <SimpleGrid
        cols={4}
        breakpoints={[
          { maxWidth: 600, cols: 1 },
          { maxWidth: 900, cols: 2 },
        ]}
      >
        {cards.map((card) => (
          <Card shadow="sm" p="lg" radius="md" withBorder key={card.title}>
            <Stack align="center" h="100%" justify="space-between">
              <FontAwesomeIcon icon={card.icon} size="4x" />

              <Box sx={{ textAlign: "center" }}>
                <Text weight={500}>{card.title}</Text>
                <Text size="sm" color="dimmed">
                  {card.description}
                </Text>
              </Box>

              <Button
                variant="light"
                color="blue"
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
