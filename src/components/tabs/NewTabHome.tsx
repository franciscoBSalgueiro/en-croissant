import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useAtom, useSetAtom, useStore } from "jotai";
import { useEffect, useState } from "react";
import {
  activeTabAtom,
  addRecentFileAtom,
  deckAtomFamily,
  type RecentFile,
  recentFilesAtom,
  tabFamily,
  tabsAtom,
} from "@/state/atoms";
import type { Tab } from "@/utils/tabs";
import { createTab } from "@/utils/tabs";
import { unwrap } from "@/utils/unwrap";
import CreateRepertoireModal from "./CreateRepertoireModal";
import ImportModal from "./ImportModal";
import "./NewTabHome.css";
import {
  IconChess,
  IconClock,
  IconFile,
  IconFileImport,
  IconPuzzle,
  IconTarget,
  IconTargetArrow,
  IconTrophy,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { getStats } from "@/components/files/opening";
import Chessboard from "../icons/Chessboard";

dayjs.extend(relativeTime);

function RecentFileDuePositions({ file }: { file: string }) {
  const [deck] = useAtom(
    deckAtomFamily({
      file,
      game: 0,
    }),
  );

  const stats = getStats(deck.positions);

  if (stats.due + stats.unseen === 0) return null;

  return (
    <Badge
      size="sm"
      variant="light"
      color="orange"
      leftSection={<IconTarget size="0.75rem" />}
    >
      {stats.due + stats.unseen} due
    </Badge>
  );
}

function fileTypeIcon(type: RecentFile["type"]) {
  switch (type) {
    case "repertoire":
      return <IconTargetArrow size={20} />;
    case "game":
      return <IconChess size={20} />;
    case "tournament":
      return <IconTrophy size={20} />;
    case "puzzle":
      return <IconPuzzle size={20} />;
    default:
      return <IconFile size={20} />;
  }
}

function RecentFileRow({
  file,
  onOpen,
}: {
  file: RecentFile;
  onOpen: (file: RecentFile) => void;
}) {
  const displayName = file.name.replace(/\.pgn$/i, "");

  return (
    <UnstyledButton
      onClick={() => onOpen(file)}
      px="sm"
      py={6}
      style={{
        borderRadius: "var(--mantine-radius-sm)",
      }}
      className="recent-file-row"
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Box style={{ flexShrink: 0, color: "var(--mantine-color-dimmed)" }}>
            {fileTypeIcon(file.type)}
          </Box>
          <Text size="sm" truncate fw={500}>
            {displayName}
          </Text>
          {file.type === "repertoire" && (
            <RecentFileDuePositions file={file.path} />
          )}
        </Group>
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Tooltip label={dayjs(file.lastOpened).format("YYYY-MM-DD HH:mm")}>
            <Group gap={4} wrap="nowrap">
              <IconClock
                size={14}
                style={{ color: "var(--mantine-color-dimmed)" }}
              />
              <Text size="xs" c="dimmed">
                {dayjs(file.lastOpened).fromNow()}
              </Text>
            </Group>
          </Tooltip>
        </Group>
      </Group>
    </UnstyledButton>
  );
}

export default function NewTabHome({ id }: { id: string }) {
  const { t } = useTranslation();

  const [openModal, setOpenModal] = useState(false);
  const [openRepertoireModal, setOpenRepertoireModal] = useState(false);
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  const [recentFiles, setRecentFiles] = useAtom(recentFilesAtom);
  const store = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    const checkFiles = async () => {
      const newRecentFiles = await Promise.all(
        recentFiles.map(async (file) => {
          const exists = await commands.fileExists(file.path);
          if (exists.status === "error" || !exists.data) {
            return null;
          }
          return file;
        }),
      );
      const filtered = newRecentFiles.filter((f) => f !== null) as RecentFile[];
      if (filtered.length !== recentFiles.length) {
        setRecentFiles(filtered);
      }
    };
    checkFiles();
  }, []);

  const openRecentFile = async (file: RecentFile) => {
    const pgn = unwrap(await commands.readGames(file.path, 0, 0));
    const tabId = await createTab({
      tab: {
        name: file.name,
        type: "analysis",
      },
      setTabs,
      setActiveTab,
      pgn: pgn[0] || "",
      fileInfo: {
        type: "file",
        name: file.name,
        path: file.path,
        numGames: 1,
        metadata: { type: file.type, tags: [] },
        lastModified: Math.floor(Date.now() / 1000),
      },
      gameNumber: 0,
    });
    if (file.type === "repertoire") {
      store.set(tabFamily(tabId), "practice");
    }
    store.set(addRecentFileAtom, {
      name: file.name,
      path: file.path,
      type: file.type,
    });
    navigate({ to: "/" });
  };

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
          tab.name = t("Home.NewGame");
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
      icon: <IconTargetArrow size={60} />,
      title: t("Home.Card.NewRepertoire.Title"),
      description: t("Home.Card.NewRepertoire.Desc"),
      label: t("Home.Card.NewRepertoire.Button"),
      onClick: () => {
        setOpenRepertoireModal(true);
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
          tab.name = t("Home.PuzzleTraining");
          tab.type = "puzzles";
          return [...prev];
        });
      },
    },
  ];

  return (
    <>
      <ImportModal openModal={openModal} setOpenModal={setOpenModal} />
      <CreateRepertoireModal
        opened={openRepertoireModal}
        setOpened={setOpenRepertoireModal}
      />
      <Stack gap="lg" pt="sm">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
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

        <Card shadow="sm" p="md" radius="md" withBorder>
          <Text fw={600} size="lg" mb="xs">
            {t("Home.RecentFiles.Title")}
          </Text>
          {recentFiles.length === 0 ? (
            <Stack align="center" justify="center" h={200} gap="xs">
              <IconClock size={48} style={{ opacity: 0.3 }} />
              <Text c="dimmed">{t("Home.RecentFiles.NoRecentFiles")}</Text>
            </Stack>
          ) : (
            <ScrollArea.Autosize mah={300}>
              <Stack gap={2}>
                {recentFiles.map((file) => (
                  <RecentFileRow
                    key={file.path}
                    file={file}
                    onOpen={openRecentFile}
                  />
                ))}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Card>
      </Stack>
    </>
  );
}
