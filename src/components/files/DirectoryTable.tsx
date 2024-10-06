import { commands } from "@/bindings";
import { activeTabAtom, deckAtomFamily, tabsAtom } from "@/state/atoms";
import { capitalize } from "@/utils/format";
import { createTab } from "@/utils/tabs";
import { unwrap } from "@/utils/unwrap";
import { Badge, Box, Group } from "@mantine/core";
import {
  IconChevronRight,
  IconEye,
  IconTarget,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { remove } from "@tauri-apps/plugin-fs";
import clsx from "clsx";
import dayjs from "dayjs";
import Fuse from "fuse.js";
import { useAtom, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useContextMenu } from "mantine-contextmenu";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import * as classes from "./DirectoryTable.css";
import type { Directory, FileMetadata } from "./file";
import { getStats } from "./opening";

function flattenFiles(
  files: (FileMetadata | Directory)[],
): (FileMetadata | Directory)[] {
  return files.flatMap((f) =>
    f.type === "directory" ? flattenFiles(f.children) : [f],
  );
}

function recursiveSort(
  files: (FileMetadata | Directory)[],
  sort: DataTableSortStatus<FileMetadata | Directory>,
): (FileMetadata | Directory)[] {
  return files
    .map((f) => {
      if (f.type === "file") return f;
      return {
        ...f,
        children: recursiveSort(f.children, sort),
      };
    })
    .sort((a, b) => {
      return b.name.localeCompare(a.name, "en", { sensitivity: "base" });
    })
    .filter((f) => {
      return f.type === "file" || f.children.length > 0;
    })
    .sort((a, b) => {
      if (sort.direction === "desc") {
        if (sort.columnAccessor === "name") {
          return b.name.localeCompare(a.name);
        }
        // @ts-ignore
        return b[sort.columnAccessor] > a[sort.columnAccessor] ? 1 : -1;
      }
      if (sort.columnAccessor === "name") {
        return a.name.localeCompare(b.name);
      }
      // @ts-ignore
      return a[sort.columnAccessor] > b[sort.columnAccessor] ? 1 : -1;
    })
    .sort((a, b) => {
      if (a.type === "directory" && b.type === "file") {
        return -1;
      }
      if (a.type === "directory" && b.type === "directory") {
        return 0;
      }
      if (a.type === "file" && b.type === "file") {
        return 0;
      }
      return 1;
    });
}

type SortStatus = DataTableSortStatus<FileMetadata | Directory>;
const sortStatusStorageId = `${DirectoryTable.name}-sort-status` as const;
const sortStatusAtom = atomWithStorage<SortStatus>(
  sortStatusStorageId,
  {
    columnAccessor: "lastModified",
    direction: "desc",
  },
  undefined,
  { getOnInit: true },
);

export default function DirectoryTable({
  files,
  isLoading,
  setFiles,
  selectedFile,
  setSelectedFile,
  search,
  filter,
}: {
  files: (FileMetadata | Directory)[] | undefined;
  isLoading: boolean;
  setFiles: (files: (FileMetadata | Directory)[]) => void;
  selectedFile: FileMetadata | null;
  setSelectedFile: (file: FileMetadata) => void;
  search: string;
  filter: string;
}) {
  const [sort, setSort] = useAtom<SortStatus>(sortStatusAtom);

  const flattedFiles = useMemo(() => flattenFiles(files ?? []), [files]);
  const fuse = useMemo(
    () =>
      new Fuse(flattedFiles ?? [], {
        keys: ["name"],
      }),
    [flattedFiles],
  );

  let filteredFiles = files ?? [];

  if (search) {
    const searchResults = fuse.search(search);
    filteredFiles = filteredFiles
      .filter((f) => searchResults.some((r) => r.item.path.includes(f.path)))
      .map((f) => {
        if (f.type === "file") return f;
        const children = f.children.filter((c) =>
          searchResults.some((r) => r.item.path.includes(c.path)),
        );
        return {
          ...f,
          children,
        };
      });
  }
  if (filter) {
    const typeFilteredFiles = flattedFiles.filter(
      (f) => (f.type === "file" && f.metadata.type) === filter,
    );
    filteredFiles = filteredFiles
      .filter((f) => typeFilteredFiles.some((r) => r.path.includes(f.path)))
      .map((f) => {
        if (f.type === "file") return f;
        const children = f.children.filter((c) =>
          typeFilteredFiles.some((r) => r.path.includes(c.path)),
        );
        return {
          ...f,
          children,
        };
      });
  }

  filteredFiles = recursiveSort(filteredFiles, sort);

  return (
    <Table
      files={filteredFiles}
      isLoading={isLoading}
      setFiles={setFiles}
      depth={0}
      selected={selectedFile}
      setSelectedFile={setSelectedFile}
      sort={sort}
      setSort={setSort}
    />
  );
}

function Table({
  files,
  isLoading,
  depth,
  setFiles,
  selected,
  setSelectedFile,
  sort,
  setSort,
}: {
  files: (FileMetadata | Directory)[];
  isLoading: boolean;
  depth: number;
  setFiles: (files: (FileMetadata | Directory)[]) => void;
  selected: FileMetadata | null;
  setSelectedFile: (file: FileMetadata) => void;
  sort: DataTableSortStatus<FileMetadata | Directory>;
  setSort: (sort: SortStatus) => void;
}) {
  const { t } = useTranslation();

  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const expandedFiles = expandedIds.filter((id) =>
    files?.find((f) => f.path === id && f.type === "directory"),
  );
  const navigate = useNavigate();
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  const { showContextMenu } = useContextMenu();

  const openFile = useCallback(
    async (record: FileMetadata) => {
      const pgn = unwrap(await commands.readGames(record.path, 0, 0));
      createTab({
        tab: {
          name: record?.name || "Untitled",
          type: "analysis",
        },
        setTabs,
        setActiveTab,
        pgn: pgn[0] || "",
        fileInfo: record,
        gameNumber: 0,
      });
      navigate({ to: "/" });
    },
    [selected, setActiveTab, setTabs, navigate],
  );

  return (
    <DataTable
      noHeader={depth > 0}
      withTableBorder={depth === 0}
      withColumnBorders
      highlightOnHover
      fetching={isLoading}
      scrollAreaProps={{
        offsetScrollbars: depth === 0,
        scrollbars: "y",
      }}
      idAccessor="path"
      rowClassName={(record) =>
        record.path === selected?.path ? classes.selected : ""
      }
      sortStatus={sort}
      onRowDoubleClick={({ record }) => {
        if (record.type === "directory") return;
        openFile(record);
      }}
      onSortStatusChange={setSort}
      columns={[
        {
          accessor: "name",
          sortable: true,
          noWrap: true,
          render: (row) => (
            <Box ml={20 * depth}>
              <Group>
                {row.type === "directory" && (
                  <IconChevronRight
                    className={clsx(classes.icon, classes.expandIcon, {
                      [classes.expandIconRotated]: expandedFiles.includes(
                        row.path,
                      ),
                    })}
                  />
                )}
                <span>{row.name}</span>
                {row.type === "file" && row.metadata.type === "repertoire" && (
                  <DuePositions file={row.path} />
                )}
              </Group>
            </Box>
          ),
        },
        {
          accessor: "metadata.type",
          title: "Type",
          width: 100,
          render: (row) =>
            t(
              `Files.FileType.${capitalize((row.type === "file" && row.metadata.type) || "Folder")}`,
            ),
        },
        {
          accessor: "lastModified",
          sortable: true,
          textAlign: "right",
          width: 200,
          render: (row) => {
            if (row.type === "directory") return null;
            return (
              <Box ml={20 * depth}>
                {dayjs(row.lastModified * 1000).format("DD MMM YYYY HH:mm")}
              </Box>
            );
          },
        },
      ]}
      records={files}
      rowExpansion={{
        allowMultiple: true,
        expanded: {
          recordIds: expandedFiles,
          onRecordIdsChange: setExpandedIds,
        },
        content: ({ record }) =>
          record.type === "directory" && (
            <Table
              files={record.children}
              isLoading={isLoading}
              setFiles={setFiles}
              depth={depth + 1}
              selected={selected}
              setSelectedFile={setSelectedFile}
              sort={sort}
              setSort={setSort}
            />
          ),
      }}
      onRowClick={({ record }) => {
        if (record.type === "file") {
          setSelectedFile(record);
        }
      }}
      onRowContextMenu={({ record, event }) => {
        return showContextMenu([
          {
            key: "open-file",
            icon: <IconEye size={16} />,
            disabled: record.type === "directory",
            onClick: () => {
              if (record.type === "directory") return;
              openFile(record);
            },
          },
          {
            key: "delete-file",
            icon: <IconTrash size={16} />,
            title: "Delete",
            color: "red",
            onClick: async () => {
              if (record.type === "directory") {
                await remove(record.path, { recursive: true });
              } else {
                await remove(record.path);
              }
              setFiles(files?.filter((f) => record.path.includes(f.path)));
            },
          },
        ])(event);
      }}
    />
  );
}

function DuePositions({ file }: { file: string }) {
  const [deck] = useAtom(
    deckAtomFamily({
      file,
      game: 0,
    }),
  );

  const stats = getStats(deck.positions);

  if (stats.due + stats.unseen === 0) return null;

  return (
    <Badge leftSection={<IconTarget size="1rem" />}>
      {stats.due + stats.unseen}
    </Badge>
  );
}
