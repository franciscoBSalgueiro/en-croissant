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
  Text,
  Textarea
} from "@mantine/core";
import { useState } from "react";
import { getCompleteGame } from "../../utils/chess";

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
      title: "Play Chess",
      description: "Play against an engine or a friend",
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
      <ImportModal />
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

  function ImportModal() {
    const [pgn, setPgn] = useState("");

    return (
      <Modal
        opened={openModal}
        onClose={() => setOpenModal(false)}
        title="Import game"
      >
        <Textarea
          value={pgn}
          onChange={(event) => setPgn(event.currentTarget.value)}
          label="PGN game"
          withAsterisk
          data-autofocus
          minRows={10}
        />

        <Button
          fullWidth
          mt="md"
          radius="md"
          onClick={() => {
            if (!pgn) return;
            setTabs((prev: any) => {
              const tab = prev.find((t: any) => t.value === id);
              const completeGame = getCompleteGame(pgn);

              sessionStorage.setItem(id, JSON.stringify(completeGame));

              tab.name = `${completeGame.white.name} - ${completeGame.black.name} (Imported)`;
              tab.type = "analysis";
              return [...prev];
            });
          }}
        >
          Load
        </Button>
      </Modal>
    );
  }
}
