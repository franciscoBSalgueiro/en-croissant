import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconChevronDown, IconCopy, IconDownload, IconTrash, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useState, type ChangeEvent } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { GameQuery, NormalizedGame } from "@/bindings";
import { getDatabases, normalizeGameQuery } from "@/utils/db";
import { getDatabasesDir } from "@/utils/directories";

export function collectionKey(file: string, query: GameQuery) {
  const { options: _, ...filters } = normalizeGameQuery(query);
  return JSON.stringify([file, filters]);
}

export function useGameCollection(
  file: string,
  query: GameQuery,
  games: NormalizedGame[],
  loading: boolean,
  onDeleted?: () => void,
  totalCount?: number | null,
) {
  const key = collectionKey(file, query);
  // In all-matching mode, ids contains only the exceptions. Selecting a large
  // result set never needs to enumerate or transfer its IDs to the frontend.
  const [selection, setSelection] = useState<{ key: string; all: boolean; ids: number[] }>({
    key,
    all: false,
    ids: [],
  });
  if (selection.key !== key) setSelection({ key, all: false, ids: [] });
  const ids = selection.key === key ? selection.ids : [];
  const all = selection.key === key && selection.all;
  const idSet = new Set(ids);
  const selectedCount = all
    ? totalCount == null
      ? null
      : Math.max(0, totalCount - ids.length)
    : ids.length;
  const hasSelection = all ? selectedCount !== 0 : ids.length > 0;
  const allSelected = all
    ? ids.length === 0
    : totalCount != null && totalCount > 0 && ids.length === totalCount;
  const selectionLabel =
    selectedCount == null
      ? "All matching games selected"
      : `${selectedCount.toLocaleString()} selected`;
  const selectAll = () => setSelection({ key, all: true, ids: [] });
  const clearSelection = () => setSelection({ key, all: false, ids: [] });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    file: string;
    ids: number[];
    action: "copy" | "delete";
  } | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [copyMode, setCopyMode] = useState("existing");
  const { data: databases } = useSWR(file ? "databases" : null, getDatabases);
  const { mutate } = useSWRConfig();
  const name = (path: string) => {
    const db = databases?.find((db) => db.file === path);
    return (db?.type === "success" && db.title) || path.split(/[\\/]/).pop() || path;
  };
  const copyDestinations = (databases ?? [])
    .filter((db) => db.type === "success" && db.file !== (pending?.file ?? file))
    .map((db) => ({ value: db.file, label: name(db.file) }));
  const selectedDestination = copyDestinations.some((db) => db.value === destination)
    ? destination
    : null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Collection action failed",
        message: String(error),
      });
    } finally {
      setBusy(false);
    }
  };
  const allIds = () =>
    invoke<number[]>("collection_ids", { file, query: normalizeGameQuery(query) });
  const affected = async () => {
    if (all) return (await allIds()).filter((id) => !idSet.has(id));
    return ids;
  };
  const refresh = async () => {
    await mutate(
      (cacheKey) =>
        cacheKey === "databases" ||
        (Array.isArray(cacheKey) &&
          [
            "games",
            "position-games",
            "tournament-games",
            "players",
            "tournaments",
            "player-game-info",
          ].includes(cacheKey[0])),
      undefined,
      {
        revalidate: true,
      },
    );
  };
  const copy = async (path: string, create: boolean) => {
    if (!pending) return;
    const count = await invoke<number>("copy_collection", {
      file: pending.file,
      ids: pending.ids,
      destination: path,
      create,
    });
    setPending(null);
    await refresh();
    notifications.show({ message: `Copied ${count} games to ${name(path)}.` });
  };
  return {
    selectAll,
    selectedCount,
    selectionProps: file
      ? {
          selectedRecords: games.filter((game) => (all ? !idSet.has(game.id) : idSet.has(game.id))),
          allRecordsSelectionCheckboxProps: {
            checked: allSelected,
            indeterminate: hasSelection && !allSelected,
            disabled: busy || loading || (!hasSelection && games.length === 0),
            "aria-label": "Select all matching games across all pages",
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              if (event.currentTarget.checked) selectAll();
              else clearSelection();
            },
          },
          onSelectedRecordsChange: (records: NormalizedGame[]) => {
            const pageIds = new Set(games.map((game) => game.id));
            const selectedIds = new Set(records.map((game) => game.id));
            setSelection({
              key,
              all,
              ids: [
                ...ids.filter((id) => !pageIds.has(id)),
                ...(all
                  ? games.filter((game) => !selectedIds.has(game.id)).map((game) => game.id)
                  : records.map((game) => game.id)),
              ],
            });
          },
          isRecordSelectable: () => !busy && !loading,
        }
      : {},
    toolbar: file ? (
      <>
        {hasSelection && (
          <Group gap="xs" py={4} justify="flex-end" wrap="nowrap">
            {hasSelection && (
              <Group gap={4} wrap="nowrap" mr="auto">
                <Text size="xs" c="dimmed" aria-live="polite">
                  {selectionLabel}
                </Text>
                <Tooltip label="Clear selection">
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="gray"
                    aria-label="Clear selection"
                    disabled={busy}
                    onClick={clearSelection}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  loading={busy}
                  rightSection={<IconChevronDown size={14} />}
                >
                  Selection actions
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{selectionLabel}</Menu.Label>
                <Menu.Item
                  leftSection={<IconDownload size={16} />}
                  disabled={busy || loading || !games.length}
                  onClick={() =>
                    void run(async () => {
                      const selected = await affected();
                      const path = await save({ filters: [{ name: "PGN", extensions: ["pgn"] }] });
                      if (path) {
                        await invoke("export_collection", {
                          file,
                          ids: selected,
                          destination: path,
                        });
                        notifications.show({ message: `Exported ${selected.length} games.` });
                      }
                    })
                  }
                >
                  Export to PGN
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconCopy size={16} />}
                  disabled={busy || loading || !games.length}
                  onClick={() =>
                    void run(async () =>
                      setPending({ file, ids: await affected(), action: "copy" }),
                    )
                  }
                >
                  Copy to database…
                </Menu.Item>
                {hasSelection && (
                  <>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<IconTrash size={16} />}
                      color="red"
                      disabled={busy || loading}
                      onClick={() =>
                        void run(async () =>
                          setPending({ file, ids: await affected(), action: "delete" }),
                        )
                      }
                    >
                      Delete selected
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        )}
        <Modal
          opened={pending?.action === "delete"}
          onClose={() => !busy && setPending(null)}
          title="Delete games"
          closeOnClickOutside={!busy}
          closeOnEscape={!busy}
        >
          <Stack>
            <Text>
              Delete exactly {pending?.ids.length} games from “{name(pending?.file || file)}”? This
              cannot be undone.
            </Text>
            <Text size="xs" c="dimmed">
              {pending?.file}
            </Text>
            <Button
              color="red"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!pending) return;
                  await invoke("delete_collection", { file: pending.file, ids: pending.ids });
                  setPending(null);
                  clearSelection();
                  onDeleted?.();
                  await refresh();
                })
              }
            >
              Delete {pending?.ids.length} games
            </Button>
          </Stack>
        </Modal>
        <Modal
          opened={pending?.action === "copy"}
          onClose={() => !busy && setPending(null)}
          title="Copy games"
          closeOnClickOutside={!busy}
          closeOnEscape={!busy}
        >
          <Stack>
            <Text size="sm" c="dimmed">
              Choose where to copy {(pending?.ids.length ?? 0).toLocaleString()} selected games.
            </Text>
            <SegmentedControl
              aria-label="Copy destination"
              fullWidth
              value={copyMode}
              onChange={setCopyMode}
              disabled={busy}
              data={[
                { label: "Existing database", value: "existing" },
                { label: "New database", value: "new" },
              ]}
            />
            {copyMode === "existing" ? (
              copyDestinations.length > 0 ? (
                <Select
                  label="Destination database"
                  placeholder="Choose a database"
                  value={selectedDestination}
                  onChange={setDestination}
                  data={copyDestinations}
                  searchable
                  nothingFoundMessage="No databases found"
                  disabled={busy}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  No other databases available. Choose New database to create one.
                </Text>
              )
            ) : (
              <Text size="sm" c="dimmed">
                Choose a name and location for the new database in the next step.
              </Text>
            )}
            <Group justify="flex-end" mt="sm">
              <Button variant="default" disabled={busy} onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button
                disabled={copyMode === "existing" && !selectedDestination}
                loading={busy}
                leftSection={<IconCopy size={16} />}
                onClick={() =>
                  void run(async () => {
                    if (copyMode === "existing") {
                      if (selectedDestination) await copy(selectedDestination, false);
                    } else {
                      const path = await save({
                        defaultPath: `${await getDatabasesDir()}/collection.duckdb`,
                        filters: [{ name: "Database", extensions: ["duckdb"] }],
                      });
                      if (path) await copy(path, true);
                    }
                  })
                }
              >
                Copy games
              </Button>
            </Group>
          </Stack>
        </Modal>
      </>
    ) : null,
  };
}
