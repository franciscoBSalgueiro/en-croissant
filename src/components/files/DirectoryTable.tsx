import { activeTabAtom, tabsAtom } from "@/atoms/atoms";
import { read_games } from "@/utils/db";
import { capitalize } from "@/utils/format";
import { createTab } from "@/utils/tabs";
import { Box } from "@mantine/core";
import { IconChevronRight, IconEye, IconTrash } from "@tabler/icons-react";
import { removeDir, removeFile } from "@tauri-apps/api/fs";
import clsx from "clsx";
import dayjs from "dayjs";
import Fuse from "fuse.js";
import { useAtom, useSetAtom } from "jotai";
import { useContextMenu } from "mantine-contextmenu";
import { DataTable, DataTableSortStatus } from "mantine-datatable";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as classes from "./DirectoryTable.css";
import { MetadataOrEntry } from "./FilesPage";
import { FileMetadata } from "./file";

function flattenFiles(files: MetadataOrEntry[]): MetadataOrEntry[] {
  return files.flatMap((f) => (f.children ? flattenFiles(f.children) : [f]));
}

function recursiveSort(
  files: MetadataOrEntry[],
  sort: DataTableSortStatus<MetadataOrEntry>,
): MetadataOrEntry[] {
  return files
    .map((f) => {
      if (!f.children) return f;
      return {
        ...f,
        children: recursiveSort(f.children, sort),
      };
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
    });
}

export default function DirectoryTable({
  files,
  isLoading,
  setFiles,
  selectedFile,
  setSelectedFile,
  search,
  filter,
}: {
  files: MetadataOrEntry[] | undefined;
  isLoading: boolean;
  setFiles: (files: MetadataOrEntry[]) => void;
  selectedFile: FileMetadata | null;
  setSelectedFile: (file: FileMetadata) => void;
  search: string;
  filter: string;
}) {
  const [sort, setSort] = useState<DataTableSortStatus<MetadataOrEntry>>({
    columnAccessor: "lastModified",
    direction: "desc",
  });

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
        if (!f.children) return f;
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
      (f) => f.metadata?.type === filter,
    );
    filteredFiles = filteredFiles
      .filter((f) => typeFilteredFiles.some((r) => r.path.includes(f.path)))
      .map((f) => {
        if (!f.children) return f;
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
  files: MetadataOrEntry[];
  isLoading: boolean;
  depth: number;
  setFiles: (files: MetadataOrEntry[]) => void;
  selected: FileMetadata | null;
  setSelectedFile: (file: FileMetadata) => void;
  sort: DataTableSortStatus<MetadataOrEntry>;
  setSort: React.Dispatch<
    React.SetStateAction<DataTableSortStatus<MetadataOrEntry>>
  >;
}) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const expandedFiles = expandedIds.filter((id) =>
    files?.find((f) => f.path === id && f.children),
  );
  const navigate = useNavigate();
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  const { showContextMenu } = useContextMenu();

  const openFile = useCallback(
    async (record: FileMetadata) => {
      const pgn = await read_games(record.path, 0, 0);
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
      navigate("/");
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
        if (record.children) return;
        openFile(record as FileMetadata);
      }}
      onSortStatusChange={setSort}
      columns={[
        {
          accessor: "name",
          sortable: true,
          noWrap: true,
          render: (row) => (
            <Box ml={20 * depth}>
              {row.children && (
                <IconChevronRight
                  className={clsx(classes.icon, classes.expandIcon, {
                    [classes.expandIconRotated]: expandedFiles.includes(
                      row.path,
                    ),
                  })}
                />
              )}
              <span>{row.name}</span>
            </Box>
          ),
        },
        {
          accessor: "metadata.type",
          title: "Type",
          width: 100,
          render: (row) => capitalize(row.metadata?.type || "Folder"),
        },
        {
          accessor: "lastModified",
          sortable: true,
          textAlign: "right",
          width: 200,
          render: (row) => {
            if (!row.lastModified) return null;
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
          record.children && (
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
        if (!record.children) {
          setSelectedFile(record as FileMetadata);
        }
      }}
      onRowContextMenu={({ record, event }) => {
        return showContextMenu([
          {
            key: "open-file",
            icon: <IconEye size={16} />,
            disabled: !!record.children,
            onClick: () => {
              if (record.children) return;
              openFile(record as FileMetadata);
            },
          },
          {
            key: "delete-file",
            icon: <IconTrash size={16} />,
            title: "Delete",
            color: "red",
            onClick: async () => {
              if (record.children) {
                await removeDir(record.path, { recursive: true });
              } else {
                await removeFile(record.path);
              }
              setFiles(files?.filter((f) => record.path.includes(f.path)));
            },
          },
        ])(event);
      }}
    />
  );
}
