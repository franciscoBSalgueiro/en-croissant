import {
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import useSWR from "swr";
import { useCallback, useEffect, useState } from "react";
import {
  activeTabAtom,
  addRecentFileAtom,
  homeEditModeAtom,
  homeLayoutAtom,
  openInEditorFamily,
  type RecentFile,
  recentFilesAtom,
  sessionsAtom,
  tabFamily,
  tabsAtom,
} from "@/state/atoms";
import { getDatabases } from "@/utils/db";
import {
  type HomeCardKind,
  type HomeListKind,
  type HomePanelKind,
  homePanels,
  normalizeHomeLayout,
} from "@/utils/homeLayout";
import type { Tab } from "@/utils/tabs";
import { createTab } from "@/utils/tabs";
import { unwrap } from "@/utils/unwrap";
import CreateRepertoireModal from "./CreateRepertoireModal";
import ImportModal from "./ImportModal";
import HomeGrid, { type HomePanelDefinition } from "./HomeGrid";
import {
  AccountCardPanel,
  AccountRows,
  AccountsList,
  accountKey,
  accountLabel,
  byLabel,
  DatabaseCardPanel,
  DatabaseGamesList,
  DatabaseRows,
  DatabasesList,
  type DatabasesState,
  FileCardPanel,
  FileRows,
  FileTypeList,
  FolderList,
  flattenEntries,
  NotFound,
  onEmptyDoubleClick,
  PicksCard,
  pathName,
} from "./HomePanels";
import classes from "./NewTabHome.module.css";
import {
  IconChess,
  IconChessKnight,
  IconClock,
  IconDatabase,
  IconFile,
  IconFileImport,
  IconFiles,
  IconFilter,
  IconFolder,
  IconListDetails,
  IconPuzzle,
  IconTargetArrow,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import Chessboard from "../icons/Chessboard";
import { FileIcon } from "@/components/files/FileIcon";
import type { FileType } from "@/components/files/file";
import { useFileDirectory } from "@/components/files/FilesPage";
import { PracticeReminderBadge } from "@/components/files/PracticeReminderBadge";

dayjs.extend(relativeTime);

function RecentFileRow({ file, onOpen }: { file: RecentFile; onOpen: (file: RecentFile) => void }) {
  const displayName = file.name.replace(/\.pgn$/i, "");

  return (
    <UnstyledButton
      onClick={() => onOpen(file)}
      px="sm"
      py={6}
      style={{
        borderRadius: "var(--mantine-radius-sm)",
      }}
      className={classes.recentFileRow}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Box style={{ flexShrink: 0, color: "var(--mantine-color-dimmed)" }}>
            <FileIcon type={file.type} size={20} />
          </Box>
          <Text size="sm" truncate fw={500}>
            {displayName}
          </Text>
          {file.type === "repertoire" && <PracticeReminderBadge file={file.path} size="sm" />}
        </Group>
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Tooltip label={dayjs(file.lastOpened).format("YYYY-MM-DD HH:mm")}>
            <Group gap={4} wrap="nowrap">
              <IconClock size={14} style={{ color: "var(--mantine-color-dimmed)" }} />
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

  const openRecentFile = useCallback(
    async (file: RecentFile) => {
      const [pgnResult, countResult] = await Promise.all([
        commands.readGames(file.path, 0, 0),
        commands.countPgnGames(file.path),
      ]);
      const pgn = unwrap(pgnResult);
      const numGames = unwrap(countResult);
      const tabId = await createTab({
        tab: {
          name: file.name,
          type: "analysis",
        },
        setTabs,
        setActiveTab,
        pgn: pgn[0] || "",
        gameOrigin: {
          kind: "file",
          gameNumber: 0,
          file: {
            type: "file",
            name: file.name,
            path: file.path,
            numGames,
            metadata: { type: file.type, tags: [] },
            lastModified: Math.floor(Date.now() / 1000),
          },
        },
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
    },
    [setTabs, setActiveTab, store, navigate],
  );

  // What the panels showing accounts, databases and files need, read only while one of them is on
  // the home screen, or while it's being edited (for the "+" overlay)
  const { documentDir } = useLoaderData({ from: "/" });
  const editing = useAtomValue(homeEditModeAtom);
  const shownKinds = new Set(
    homePanels(normalizeHomeLayout(useAtomValue(homeLayoutAtom))).map((panel) => panel.kind),
  );
  const needs = (kinds: HomePanelKind[]) => editing || kinds.some((kind) => shownKinds.has(kind));
  const sessions = useAtomValue(sessionsAtom);
  const { data: databaseList, mutate: mutateDatabases } = useSWR(
    needs([
      "account",
      "accountPicks",
      "accounts",
      "database",
      "databasePicks",
      "databases",
      "databaseGames",
    ])
      ? "databases"
      : null,
    getDatabases,
  );
  const databases: DatabasesState = {
    databases: databaseList,
    setDatabases: (list) => mutateDatabases(list, { revalidate: false }),
  };
  const fileDirectory = useFileDirectory(
    needs(["file", "filePicks", "folder", "fileType"]) ? documentDir : null,
  );
  // A Files folder that can't be read shows as empty
  const entries = fileDirectory.files ?? (fileDirectory.error ? [] : undefined);
  const { files, folders } = flattenEntries(entries ?? []);
  const filesRead = entries === undefined ? undefined : files;
  const relativePath = (path: string) =>
    path.startsWith(documentDir) ? path.slice(documentDir.length + 1) : path;

  const accountTargets = sessions
    .map(accountKey)
    .filter((key) => key !== null)
    .map((key) => ({ key, label: accountLabel(key) }))
    .sort(byLabel);
  // In the "+" overlay and the pickers: by name
  const databaseTargets = databaseList
    ?.filter((db) => db.type === "success")
    .map((db) => ({ key: db.file, label: db.title }))
    .sort(byLabel);
  // A file in a folder (not straight in the Files folder) has the folder under its name, to tell
  // apart files with the same name
  const fileTargets = filesRead
    ?.map((file) => {
      const folder = relativePath(file.path).replace(/[\\/]?[^\\/]*$/, "");
      return { key: file.path, label: file.name, description: folder || undefined };
    })
    .sort(byLabel);
  const folderTargets = entries && [
    { key: documentDir, label: t("Home.Panel.AllFiles") },
    ...folders
      .map((folder) => ({ key: folder.path, label: relativePath(folder.path) }))
      .sort(byLabel),
  ];
  const fileTypeLists: Record<FileType, string> = {
    repertoire: t("Home.Panel.FileType.Repertoire"),
    game: t("Home.Panel.FileType.Game"),
    tournament: t("Home.Panel.FileType.Tournament"),
    puzzle: t("Home.Panel.FileType.Puzzle"),
    other: t("Home.Panel.FileType.Other"),
  };
  // Alphabetical, but "other" last, by convention
  const fileTypeTargets = (Object.keys(fileTypeLists) as FileType[])
    .map((type) => ({ key: type, label: fileTypeLists[type] }))
    .sort((a, b) => Number(a.key === "other") - Number(b.key === "other") || byLabel(a, b));
  const loading = (
    <Center h="100%">
      <Loader size="sm" />
    </Center>
  );

  const cards: Record<HomeCardKind, HomePanelDefinition> = {
    playChess: homeCard({
      group: "board",
      icon: IconChess,
      title: t("Home.Card.PlayChess.Title"),
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
    }),
    analysisBoard: homeCard({
      group: "board",
      icon: Chessboard,
      title: t("Home.Card.AnalysisBoard.Title"),
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
    }),
    newRepertoire: homeCard({
      group: "files",
      icon: IconTargetArrow,
      title: t("Home.Card.NewRepertoire.Title"),
      label: t("Home.Card.NewRepertoire.Button"),
      onClick: () => {
        setOpenRepertoireModal(true);
      },
    }),
    importGame: homeCard({
      group: "board",
      icon: IconFileImport,
      title: t("Home.Card.ImportGame.Title"),
      label: t("Home.Card.ImportGame.Button"),
      onClick: () => {
        setOpenModal(true);
      },
    }),
    puzzles: homeCard({
      group: "board",
      icon: IconPuzzle,
      title: t("Home.Card.Puzzle.Title"),
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
    }),
    boardEditor: homeCard({
      group: "board",
      icon: IconChessKnight,
      title: t("Home.Card.BoardEditor.Title"),
      label: t("Home.Card.BoardEditor.Button"),
      onClick: () => {
        store.set(openInEditorFamily(id), true);
        setTabs((prev: Tab[]) => {
          const tab = prev.find((t) => t.value === id);
          if (!tab) return prev;
          tab.name = t("Home.Card.AnalysisBoard.Title");
          tab.type = "analysis";
          return [...prev];
        });
      },
    }),
    account: {
      group: "accounts",
      icon: IconUser,
      title: t("Home.Panel.Account.Title"),
      targets: accountTargets,
      noTargets: t("Home.Panel.NoAccounts"),
      render: (panel) => (
        <AccountCardPanel target={panel.target!} sessions={sessions} databases={databases} />
      ),
    },
    accountPicks: {
      group: "accounts",
      icon: IconUsers,
      title: t("Home.Panel.AccountPicks.Title"),
      pickFrom: accountTargets,
      render: (panel) => (
        <PicksCard title={t("Home.Panel.AccountsHeading")}>
          <AccountRows keys={panel.items ?? []} sessions={sessions} databases={databases} />
        </PicksCard>
      ),
    },
    database: {
      group: "databases",
      icon: IconDatabase,
      title: t("Home.Panel.Database.Title"),
      targets: databaseTargets,
      noTargets: t("Home.Panel.NoDatabases"),
      render: (panel) => <DatabaseCardPanel target={panel.target!} databases={databaseList} />,
    },
    databasePicks: {
      group: "databases",
      icon: IconDatabase,
      title: t("Home.Panel.DatabasePicks.Title"),
      pickFrom: databaseTargets,
      render: (panel) => (
        <PicksCard title={t("Home.Panel.DatabasesHeading")}>
          {databaseList ? (
            <DatabaseRows files={panel.items ?? []} databases={databaseList} showGames={false} />
          ) : (
            loading
          )}
        </PicksCard>
      ),
    },
    file: {
      group: "files",
      icon: IconFile,
      title: t("Home.Panel.File.Title"),
      targets: fileTargets,
      noTargets: t("Home.Panel.NoFiles"),
      render: (panel) => <FileCardPanel target={panel.target!} files={filesRead} />,
    },
    filePicks: {
      group: "files",
      icon: IconFiles,
      title: t("Home.Panel.FilePicks.Title"),
      pickFrom: fileTargets,
      render: (panel) => (
        <PicksCard title={t("Home.Panel.FilesHeading")}>
          {filesRead ? <FileRows paths={panel.items ?? []} files={filesRead} /> : loading}
        </PicksCard>
      ),
    },
  };

  const lists: Record<HomeListKind, HomePanelDefinition> = {
    recentFiles: {
      group: "files",
      icon: IconClock,
      title: t("Home.RecentFiles.Title"),
      render: () =>
        recentFiles.length === 0 ? (
          <Stack align="center" justify="center" h="100%" gap="xs">
            <IconClock size={48} style={{ opacity: 0.3 }} />
            <Text c="dimmed">{t("Home.RecentFiles.NoRecentFiles")}</Text>
          </Stack>
        ) : (
          <ScrollArea h="100%">
            <Stack gap={2}>
              {recentFiles.map((file) => (
                <RecentFileRow key={file.path} file={file} onOpen={openRecentFile} />
              ))}
            </Stack>
          </ScrollArea>
        ),
    },
    accounts: {
      group: "accounts",
      icon: IconUsers,
      title: t("Home.Panel.Accounts.Title"),
      listTitle: () => t("Home.Panel.AccountsHeading"),
      render: () => <AccountsList sessions={sessions} databases={databases} />,
    },
    databases: {
      group: "databases",
      icon: IconDatabase,
      title: t("Home.Panel.Databases.Title"),
      listTitle: () => t("Home.Panel.DatabasesHeading"),
      render: () => <DatabasesList databases={databaseList} />,
    },
    databaseGames: {
      group: "databases",
      icon: IconListDetails,
      title: t("Home.Panel.DatabaseGames.Title"),
      targets: databaseTargets,
      noTargets: t("Home.Panel.NoDatabases"),
      listTitle: (panel) => {
        const database = databaseList?.find((db) => db.file === panel.target);
        return database?.type === "success" ? database.title : pathName(panel.target!);
      },
      render: (panel) => {
        if (!databaseList) return loading;
        const database = databaseList.find((db) => db.file === panel.target);
        return database?.type === "success" ? (
          <DatabaseGamesList file={database.file} />
        ) : (
          <Center h="100%">
            <NotFound name={pathName(panel.target!)} />
          </Center>
        );
      },
    },
    folder: {
      group: "files",
      icon: IconFolder,
      title: t("Home.Panel.Folder.Title"),
      targets: folderTargets,
      noTargets: t("Home.Panel.NoFiles"),
      listTitle: (panel) =>
        panel.target === documentDir ? t("Home.Panel.AllFiles") : pathName(panel.target!),
      render: (panel) => {
        if (!entries) return loading;
        const folderEntries =
          panel.target === documentDir
            ? entries
            : folders.find((folder) => folder.path === panel.target)?.children;
        return folderEntries ? (
          <FolderList entries={folderEntries} refresh={fileDirectory.mutate} />
        ) : (
          <Center h="100%">
            <NotFound name={pathName(panel.target!)} />
          </Center>
        );
      },
    },
    fileType: {
      group: "files",
      icon: IconFilter,
      title: t("Home.Panel.FileType.Title"),
      targets: fileTypeTargets,
      listTitle: (panel) => fileTypeLists[panel.target as FileType] ?? panel.target!,
      render: (panel) => <FileTypeList type={panel.target!} files={filesRead} />,
    },
  };

  return (
    <>
      <ImportModal
        openModal={openModal}
        setOpenModal={setOpenModal}
        setTabs={setTabs}
        setActiveTab={setActiveTab}
      />
      <CreateRepertoireModal opened={openRepertoireModal} setOpened={setOpenRepertoireModal} />
      <HomeGrid cards={cards} lists={lists} />
    </>
  );
}

// The cards that made up the home screen before it could be customized
function homeCard({
  group,
  icon: Icon,
  title,
  label,
  onClick,
}: Omit<HomePanelDefinition, "render"> & {
  label: string;
  onClick: () => void;
}): HomePanelDefinition {
  return {
    group,
    icon: Icon,
    title,
    render: () => (
      <Card
        shadow="sm"
        p="md"
        radius="md"
        withBorder
        h="100%"
        onDoubleClick={onEmptyDoubleClick(onClick)}
      >
        <Stack align="center" h="100%" justify="space-between">
          <Icon size={60} />

          <Text fw={500} ta="center" maw="100%" truncate>
            {title}
          </Text>

          <Button variant="light" fullWidth radius="md" onClick={onClick}>
            {label}
          </Button>
        </Stack>
      </Card>
    ),
  };
}
