import {
  faChess,
  faChessBoard,
  faFileImport,
  faPuzzlePiece,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Box,
  Button,
  Card,
  Divider,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { open } from "@tauri-apps/api/dialog";

import { readTextFile } from "@tauri-apps/api/fs";
import { useState } from "react";
import { getCompleteGame } from "../../utils/chess";
import { getChesscomGame } from "../../utils/chesscom";
import { getLichessGame } from "../../utils/lichess";
import { Tab } from "../../utils/tabs";
import FileInput from "../common/FileInput";

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
      <ImportModal
        openModal={openModal}
        setOpenModal={setOpenModal}
        setTabs={setTabs}
        id={id}
      />
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
}

function ImportModal({
  openModal,
  setOpenModal,
  setTabs,
  id,
}: {
  openModal: boolean;
  setOpenModal: React.Dispatch<React.SetStateAction<boolean>>;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  id: string;
}) {
  const [pgn, setPgn] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [importType, setImportType] = useState<string>("PGN");

  return (
    <Modal
      opened={openModal}
      onClose={() => setOpenModal(false)}
      title="Import game"
    >
      <Select
        label="Type of import"
        placeholder="Pick one"
        mb="lg"
        data={[
          { value: "PGN", label: "PGN" },
          { value: "Link", label: "Link" },
        ]}
        value={importType}
        onChange={(v) => setImportType(v!)}
      />

      {importType === "PGN" && (
        <>
          <FileInput
            label="PGN file"
            description={"Click to select a PGN file."}
            onClick={async () => {
              const selected = (await open({
                multiple: false,

                filters: [
                  {
                    name: "PGN file",
                    extensions: ["pgn"],
                  },
                ],
              })) as string;
              setFile(selected);
            }}
            disabled={pgn !== ""}
            filename={file}
          />
          <Divider label="OR" labelPosition="center" />
          <Textarea
            value={pgn}
            disabled={file !== null}
            onChange={(event) => setPgn(event.currentTarget.value)}
            label="PGN game"
            data-autofocus
            minRows={10}
          />
        </>
      )}

      {importType === "Link" && (
        <TextInput
          value={link}
          onChange={(event) => setLink(event.currentTarget.value)}
          label="Game URL (lichess or chess.com)"
          data-autofocus
        />
      )}

      <Button
        fullWidth
        mt="md"
        radius="md"
        disabled={importType === "PGN" ? !pgn && !file : !link}
        onClick={async () => {
          if (importType === "PGN") {
            if (file || pgn) {
              const input = file ? await readTextFile(file) : pgn;
              setTabs((prevTabs) =>
                prevTabs.map((tab) => {
                  if (tab.value === id) {
                    const completeGame = getCompleteGame(input);
                    sessionStorage.setItem(id, JSON.stringify(completeGame));
                    return {
                      ...tab,
                      name: `${completeGame.game.white.name} - ${completeGame.game.black.name} (Imported)`,
                      type: "analysis",
                    };
                  }
                  return tab;
                })
              );
            }
          } else if (importType === "Link") {
            if (!link) return;
            let pgn = "";
            if (link.includes("chess.com")) {
              pgn = await getChesscomGame(link);
            } else if (link.includes("lichess")) {
              const gameId = link.split("/")[3];
              pgn = await getLichessGame(gameId);
            }

            setTabs((prev) => {
              const tab = prev.find((t) => t.value === id)!;
              const completeGame = getCompleteGame(pgn);

              sessionStorage.setItem(id, JSON.stringify(completeGame));

              tab.name = `${completeGame.game.white.name} - ${completeGame.game.black.name} (Imported)`;
              tab.type = "analysis";
              return [...prev];
            });
          }
        }}
      >
        Load
      </Button>
    </Modal>
  );
}
