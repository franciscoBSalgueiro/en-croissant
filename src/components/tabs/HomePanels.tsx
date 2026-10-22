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
  UnstyledButton,
} from "@mantine/core";
import { IconBook, IconDatabase, IconQuestionMark, IconTarget } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { remove } from "@tauri-apps/plugin-fs";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { type MouseEvent, type ReactNode, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import useSWRInfinite from "swr/infinite";
import type { DatabaseInfo, NormalizedGame } from "@/bindings";
import { LichessOrChessCom } from "@/components/common/AccountCards";
import ConfirmModal from "@/components/common/ConfirmModal";
import DirectoryTree from "@/components/files/DirectoryTree";
import type { Directory, FileMetadata } from "@/components/files/file";
import { FileIcon } from "@/components/files/FileIcon";
import { getStats } from "@/components/files/opening";
import { PracticeReminderBadge } from "@/components/files/PracticeReminderBadge";
import {
  activeTabAtom,
  deckAtomFamily,
  sessionsAtom,
  startPracticeFamily,
  tabsAtom,
} from "@/state/atoms";
import { useActiveDatabaseViewStore } from "@/state/store/database";
import { query_games, type SuccessDatabaseInfo } from "@/utils/db";
import { openFile } from "@/utils/files";
import { formatNumber } from "@/utils/format";
import type { Session } from "@/utils/session";
import { createTab } from "@/utils/tabs";
import classes from "./NewTabHome.module.css";

// The home screen's cards and lists that show particular things: accounts, databases and files

type Entry = FileMetadata | Directory;

// How a saved layout refers to an account: its site and username
export function accountKey(session: Session) {
  if (session.lichess) return `lichess:${session.lichess.username}`;
  if (session.chessCom) return `chesscom:${session.chessCom.username}`;
  return null;
}

export function accountLabel(key: string) {
  const [site, ...username] = key.split(":");
  return `${username.join(":")} · ${site === "lichess" ? "Lichess" : "Chess.com"}`;
}

export function byLabel(a: { label: string }, b: { label: string }) {
  return a.label.localeCompare(b.label);
}

// The last part of a path, without .pgn
export function pathName(path: string) {
  return (path.split(/[\\/]/).pop() ?? path).replace(/\.pgn$/, "");
}

export function flattenEntries(entries: Entry[]): { files: FileMetadata[]; folders: Directory[] } {
  const files: FileMetadata[] = [];
  const folders: Directory[] = [];
  for (const entry of entries) {
    if (entry.type === "file") {
      files.push(entry);
    } else {
      folders.push(entry);
      const inside = flattenEntries(entry.children);
      files.push(...inside.files);
      folders.push(...inside.folders);
    }
  }
  return { files, folders };
}

function useOpenDatabase() {
  const navigate = useNavigate();
  const setActiveDatabase = useActiveDatabaseViewStore((s) => s.setDatabase);
  // As Explore, or a double-click, on the Databases page
  return (database: SuccessDatabaseInfo) => {
    setActiveDatabase(database);
    navigate({ to: "/databases/$databaseId", params: { databaseId: database.title } });
  };
}

function useOpenFile() {
  const setTabs = useSetAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const store = useStore();
  // As on the Files page; a repertoire can also start practicing as it opens
  return async (file: FileMetadata, practice?: "due" | "full") => {
    const tab = await openFile(file, setTabs, setActiveTab);
    if (practice) {
      store.set(startPracticeFamily(tab), practice);
    }
  };
}

// A double-click on a card does what it's for (what its main button does), unless it was on a
// button that does something else
export function onEmptyDoubleClick(open: () => void) {
  return (e: MouseEvent) => {
    if (!(e.target as Element).closest("button:not([data-disabled]), a, input")) {
      open();
    }
  };
}

export function NotFound({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <Text size="sm" c="dimmed" ta="center">
      {t("Home.Panel.NotFound", { name, interpolation: { escapeValue: false } })}
    </Text>
  );
}

function NotFoundCard({ name }: { name: string }) {
  return (
    <Card shadow="sm" p="md" radius="md" withBorder h="100%">
      <Stack align="center" justify="center" h="100%" gap="xs">
        <IconQuestionMark size={40} style={{ opacity: 0.4 }} />
        <NotFound name={name} />
      </Stack>
    </Card>
  );
}

function PanelRow({
  icon,
  label,
  right,
  onOpen,
}: {
  icon: ReactNode;
  label: string;
  right?: ReactNode;
  onOpen: () => void;
}) {
  return (
    <UnstyledButton onClick={onOpen} px="sm" py={6} className={classes.recentFileRow}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Box style={{ flexShrink: 0, display: "flex", color: "var(--mantine-color-dimmed)" }}>
            {icon}
          </Box>
          <Text size="sm" truncate fw={500}>
            {label}
          </Text>
        </Group>
        {right && (
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            {right}
          </Group>
        )}
      </Group>
    </UnstyledButton>
  );
}

// A card showing a few things the user picked, one per row. Cards don't scroll: rows that don't fit
// (only once the window is smaller than when they were picked) stay out of sight. Less padding
// below the rows than elsewhere, so a sixth file fits a card of its largest size.
export function PicksCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card shadow="sm" p="md" radius="md" withBorder h="100%" style={{ paddingBottom: "0.5rem" }}>
      <Text fw={600} mb="xs" truncate>
        {title}
      </Text>
      <div className={classes.picksRows}>{children}</div>
    </Card>
  );
}

// A list's rows, scrolling once they don't fit
function ListRows({
  isEmpty,
  empty,
  children,
}: {
  isEmpty: boolean;
  empty: string;
  children: ReactNode;
}) {
  if (isEmpty) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          {empty}
        </Text>
      </Center>
    );
  }
  return (
    <ScrollArea h="100%">
      <Stack gap={2}>{children}</Stack>
    </ScrollArea>
  );
}

function Loading() {
  return (
    <Center h="100%">
      <Loader size="sm" />
    </Center>
  );
}

// Accounts

export type DatabasesState = {
  databases: DatabaseInfo[] | undefined;
  setDatabases: (databases: DatabaseInfo[]) => void;
};

// The account's card from the Accounts page, without its remove button (or just its top bar, as a
// row); a double-click opens the account's games
export function AccountPanel({
  session,
  compact,
  databases,
}: {
  session: Session;
  compact?: boolean;
  databases: DatabasesState;
}) {
  const setSessions = useSetAtom(sessionsAtom);
  const openDatabase = useOpenDatabase();
  return (
    <LichessOrChessCom
      session={session}
      databases={databases.databases ?? []}
      setDatabases={(update) =>
        databases.setDatabases(
          typeof update === "function" ? update(databases.databases ?? []) : update,
        )
      }
      setSessions={setSessions}
      display={{ homeScreen: true, compact, onOpenDatabase: openDatabase }}
    />
  );
}

export function AccountCardPanel({
  target,
  sessions,
  databases,
}: {
  target: string;
  sessions: Session[];
  databases: DatabasesState;
}) {
  const session = sessions.find((s) => accountKey(s) === target);
  if (!session) return <NotFoundCard name={accountLabel(target)} />;
  return <AccountPanel session={session} databases={databases} />;
}

export function AccountRows({
  keys,
  sessions,
  databases,
}: {
  keys: string[];
  sessions: Session[];
  databases: DatabasesState;
}) {
  return keys.map((key) => {
    const session = sessions.find((s) => accountKey(s) === key);
    return session ? (
      // No side padding (unlike file rows, an account row has no hover highlight that needs it), so
      // the name has the room
      <Box key={key} py={2} className={classes.picksAccountRow}>
        <AccountPanel session={session} databases={databases} compact />
      </Box>
    ) : (
      <NotFound key={key} name={accountLabel(key)} />
    );
  });
}

export function AccountsList({
  sessions,
  databases,
}: {
  sessions: Session[];
  databases: DatabasesState;
}) {
  const { t } = useTranslation();
  const keys = sessions
    .map(accountKey)
    .filter((key) => key !== null)
    .sort((a, b) => accountLabel(a).localeCompare(accountLabel(b)));
  return (
    <ListRows isEmpty={keys.length === 0} empty={t("Home.Accounts.Empty.Title")}>
      <AccountRows keys={keys} sessions={sessions} databases={databases} />
    </ListRows>
  );
}

// Databases

function gamesCount(t: TFunction, count: number) {
  return t("Home.Panel.Games", { count, formatted: formatNumber(count) });
}

export function DatabaseCardPanel({
  target,
  databases,
}: {
  target: string;
  databases: DatabaseInfo[] | undefined;
}) {
  const { t } = useTranslation();
  const openDatabase = useOpenDatabase();
  if (!databases) {
    return (
      <Card shadow="sm" p="md" radius="md" withBorder h="100%">
        <Loading />
      </Card>
    );
  }
  const database = databases.find((db) => db.file === target);
  if (database?.type !== "success") return <NotFoundCard name={pathName(target)} />;
  return (
    <Card
      shadow="sm"
      p="md"
      radius="md"
      withBorder
      h="100%"
      onDoubleClick={onEmptyDoubleClick(() => openDatabase(database))}
    >
      <Stack align="center" h="100%" justify="space-between">
        <IconDatabase size={60} />
        <Box ta="center" maw="100%">
          <Text fw={500} truncate>
            {database.title}
          </Text>
          <Text size="sm" c="dimmed">
            {gamesCount(t, database.game_count)}
          </Text>
        </Box>
        <Button variant="light" fullWidth radius="md" onClick={() => openDatabase(database)}>
          {t("Common.Open")}
        </Button>
      </Stack>
    </Card>
  );
}

export function DatabaseRows({
  files,
  databases,
  showGames = true,
}: {
  files: string[];
  databases: DatabaseInfo[];
  // Not on a picks card, where a database's name needs the room
  showGames?: boolean;
}) {
  const { t } = useTranslation();
  const openDatabase = useOpenDatabase();
  return files.map((file) => {
    const database = databases.find((db) => db.file === file);
    return database?.type === "success" ? (
      <PanelRow
        key={file}
        icon={<IconDatabase size={20} />}
        label={database.title}
        right={
          showGames && (
            <Text size="xs" c="dimmed">
              {gamesCount(t, database.game_count)}
            </Text>
          )
        }
        onOpen={() => openDatabase(database)}
      />
    ) : (
      <NotFound key={file} name={pathName(file)} />
    );
  });
}

export function DatabasesList({ databases }: { databases: DatabaseInfo[] | undefined }) {
  const { t } = useTranslation();
  if (!databases) return <Loading />;
  const files = databases
    .filter((db) => db.type === "success")
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((db) => db.file);
  return (
    <ListRows isEmpty={files.length === 0} empty={t("Home.Panel.NoDatabases")}>
      <DatabaseRows files={files} databases={databases} />
    </ListRows>
  );
}

const GAMES_PAGE = 50;

// A database's games, newest first, loading more as the list scrolls down
export function DatabaseGamesList({ file }: { file: string }) {
  const { t } = useTranslation();
  const setTabs = useSetAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const { data, isLoading, setSize } = useSWRInfinite(
    (index, previous: NormalizedGame[] | null) =>
      previous && previous.length < GAMES_PAGE ? null : ["home-database-games", file, index + 1],
    async ([, file, page]: [string, string, number]) =>
      (
        await query_games(file, {
          options: {
            page,
            pageSize: GAMES_PAGE,
            sort: "date",
            direction: "desc",
            skipCount: true,
          },
        })
      ).data,
  );
  if (isLoading) return <Loading />;
  const games = data?.flat() ?? [];

  // As a double-click on a game in the database
  function openGame(game: NormalizedGame) {
    createTab({
      tab: { name: `${game.white} - ${game.black}`, type: "analysis" },
      setTabs,
      setActiveTab,
      pgn: game.moves,
      headers: game,
      gameOrigin: { kind: "database", database: file, gameId: game.id },
    });
  }

  if (games.length === 0) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          {t("Home.Databases.Empty.Title")}
        </Text>
      </Center>
    );
  }
  return (
    <ScrollArea h="100%" onBottomReached={() => setSize((size) => size + 1)}>
      <Stack gap={2}>
        {games.map((game) => (
          <PanelRow
            key={game.id}
            icon={<FileIcon type="game" size={20} />}
            label={`${game.white} – ${game.black}`}
            right={
              <Text size="xs" c="dimmed">
                {game.result} · {game.date}
              </Text>
            }
            onOpen={() => openGame(game)}
          />
        ))}
      </Stack>
    </ScrollArea>
  );
}

// Files

export function FileCardPanel({
  target,
  files,
}: {
  target: string;
  files: FileMetadata[] | undefined;
}) {
  const { t } = useTranslation();
  const open = useOpenFile();
  if (!files) {
    return (
      <Card shadow="sm" p="md" radius="md" withBorder h="100%">
        <Loading />
      </Card>
    );
  }
  const file = files.find((f) => f.path === target);
  if (!file) return <NotFoundCard name={pathName(target)} />;
  if (file.metadata.type === "repertoire") return <RepertoireCard file={file} />;
  return (
    <Card
      shadow="sm"
      p="md"
      radius="md"
      withBorder
      h="100%"
      onDoubleClick={onEmptyDoubleClick(() => open(file))}
    >
      <Stack align="center" h="100%" justify="space-between">
        <FileIcon type={file.metadata.type} size={60} />
        <Box ta="center" maw="100%">
          <Text fw={500} truncate>
            {file.name}
          </Text>
          {/* Any file can hold several games: the count shows when it does, and always for a
              tournament (the one type that's meant to) */}
          {(file.metadata.type === "tournament" || file.numGames > 1) && (
            <Text size="sm" c="dimmed">
              {file.metadata.type === "puzzle"
                ? t("Home.Panel.Puzzles", {
                    count: file.numGames,
                    formatted: formatNumber(file.numGames),
                  })
                : gamesCount(t, file.numGames)}
            </Text>
          )}
        </Box>
        <Button variant="light" fullWidth radius="md" onClick={() => open(file)}>
          {t("Common.Open")}
        </Button>
      </Stack>
    </Card>
  );
}

// Practice from the home screen, with the practice page's buttons
function RepertoireCard({ file }: { file: FileMetadata }) {
  const { t } = useTranslation();
  const open = useOpenFile();
  const deck = useAtomValue(deckAtomFamily({ file: file.path, game: 0 }));
  const stats = getStats(deck.positions);
  // A repertoire never practiced has no cards yet: they're made when it opens
  const nothingDue = deck.positions.length > 0 && stats.due + stats.unseen === 0;

  return (
    <Card
      shadow="sm"
      p="md"
      radius="md"
      withBorder
      h="100%"
      onDoubleClick={onEmptyDoubleClick(() => open(file))}
    >
      <Stack h="100%" justify="space-between" gap="sm">
        <Group gap="xs" wrap="nowrap" justify="center">
          <Box style={{ flexShrink: 0, display: "flex" }}>
            <FileIcon type="repertoire" size={24} />
          </Box>
          <Text fw={500} truncate>
            {file.name}
          </Text>
        </Group>
        <Stack gap="xs">
          <Button
            variant="light"
            color="gray"
            fullWidth
            radius="md"
            justify="space-between"
            leftSection={<IconTarget size={18} />}
            rightSection={<PracticeReminderBadge file={file.path} size="sm" />}
            data-disabled={nothingDue || undefined}
            onClick={nothingDue ? undefined : () => open(file, "due")}
          >
            {t("Board.Practice.StartPractice")}
          </Button>
          <Button
            variant="light"
            color="gray"
            fullWidth
            radius="md"
            justify="space-between"
            leftSection={<IconBook size={18} />}
            rightSection={<span />}
            onClick={() => open(file, "full")}
          >
            {t("Board.Practice.PracticeFullRepertoire")}
          </Button>
          <Button variant="light" fullWidth radius="md" onClick={() => open(file)}>
            {t("Common.Open")}
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}

function FileRow({ file }: { file: FileMetadata }) {
  const open = useOpenFile();
  return (
    <PanelRow
      icon={<FileIcon type={file.metadata.type} size={20} />}
      label={file.name}
      right={
        file.metadata.type === "repertoire" && <PracticeReminderBadge file={file.path} size="sm" />
      }
      onOpen={() => open(file)}
    />
  );
}

export function FileRows({ paths, files }: { paths: string[]; files: FileMetadata[] }) {
  return paths.map((path) => {
    const file = files.find((f) => f.path === path);
    return file ? (
      <FileRow key={path} file={file} />
    ) : (
      <NotFound key={path} name={pathName(path)} />
    );
  });
}

// Every file of one type in the Files folder
export function FileTypeList({ type, files }: { type: string; files: FileMetadata[] | undefined }) {
  const { t } = useTranslation();
  if (!files) return <Loading />;
  // By name, as the Files page sorts them
  const ordered = files
    .filter((file) => file.metadata.type === type)
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <ListRows isEmpty={ordered.length === 0} empty={t("Home.Panel.NoFilesOfType")}>
      {ordered.map((file) => (
        <FileRow key={file.path} file={file} />
      ))}
    </ListRows>
  );
}

// One folder as the Files page shows it: subfolders open and close, a double-click opens a file
export function FolderList({
  entries,
  refresh,
}: {
  entries: Entry[] | undefined;
  refresh: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Entry | null>(null);
  const [toDelete, setToDelete] = useState<Entry | null>(null);
  if (!entries) return <Loading />;

  // As on the Files page
  async function confirmDelete() {
    if (!toDelete) return;
    if (toDelete.type === "directory") {
      await remove(toDelete.path, { recursive: true });
    } else {
      await remove(toDelete.path);
      await remove(toDelete.path.replace(".pgn", ".info")).catch(() => {});
    }
    await refresh();
    setToDelete(null);
  }

  return (
    <>
      {entries.length === 0 ? (
        <Center h="100%">
          <Text c="dimmed" size="sm">
            {t("Home.Panel.EmptyFolder")}
          </Text>
        </Center>
      ) : (
        <ScrollArea h="100%">
          <DirectoryTree
            files={entries}
            refreshDirectory={refresh}
            selectedFile={selected}
            setSelectedFile={setSelected}
            onRequestDelete={setToDelete}
            search=""
            filter=""
          />
        </ScrollArea>
      )}
      <ConfirmModal
        title={t("Files.Delete.Title")}
        description={t("Files.Delete.Message", { fileName: toDelete?.name })}
        opened={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
