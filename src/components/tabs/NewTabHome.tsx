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

import { useState } from "react";
import { getPgnHeaders, parsePGN } from "../../utils/chess";
import { getChesscomGame } from "../../utils/chesscom";
import { count_pgn_games, read_games } from "../../utils/db";
import { getLichessGame } from "../../utils/lichess";
import { FileInfo, Tab } from "../../utils/tabs";
import FileInput from "../common/FileInput";

export default function NewTabHome({
  setTabs,
  id,
}: {
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
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
  const [loading, setLoading] = useState(false);

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
        onChange={(v) => setImportType(v as string)}
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
        loading={loading}
        disabled={importType === "PGN" ? !pgn && !file : !link}
        onClick={async () => {
          if (importType === "PGN") {
            if (file || pgn) {
              let fileInfo: FileInfo | undefined;
              let input = pgn;
              if (file) {
                setLoading(true);
                const count = await count_pgn_games(file);
                input = (await read_games(file, 0, 1))[0];
                setLoading(false);

                fileInfo = {
                  path: file,
                  numGames: count,
                };
              }
              // const input = file ? await readTextFile(file) : pgn;
              setTabs((prevTabs) =>
                prevTabs.map((tab) => {
                  if (tab.value === id) {
                    const tree = parsePGN(input);
                    tree.headers = getPgnHeaders(input);
                    sessionStorage.setItem(id, JSON.stringify(tree));
                    return {
                      ...tab,
                      name: `${tree.headers.white.name} - ${tree.headers.black.name} (Imported)`,
                      file: fileInfo,
                      gameNumber: 0,
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
              const tab = prev.find((t) => t.value === id);
              if (!tab) return prev;
              const tree = parsePGN(pgn);
              tree.headers = getPgnHeaders(pgn);
              sessionStorage.setItem(id, JSON.stringify(tree));

              tab.name = `${tree.headers.white.name} - ${tree.headers.black.name} (Imported)`;
              tab.type = "analysis";
              return [...prev];
            });
          }
        }}
      >
        {loading ? "Importing..." : "Import"}
      </Button>
    </Modal>
  );
}
