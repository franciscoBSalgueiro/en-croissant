import { Badge, Box } from "@mantine/core";
import {
  IconChevronRight,
  IconEye,
  IconFolder,
  IconFolderOpen,
  IconTarget,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { basename, join, sep } from "@tauri-apps/api/path";
import { rename } from "@tauri-apps/plugin-fs";
import clsx from "clsx";
import Fuse from "fuse.js";
import { useAtom, useSetAtom } from "jotai";
import { useContextMenu } from "mantine-contextmenu";
import Draggable from "react-draggable";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import { activeTabAtom, deckAtomFamily, tabsAtom } from "@/state/atoms";
import { openFile } from "@/utils/files";
import * as classes from "./DirectoryTree.css";
import type { Directory, FileMetadata } from "./file";
import { getStats } from "./opening";
import { FileIcon } from "./FileIcon";

type DragContextType = {
  draggingPath: string | null;
  setDraggingPath: (path: string | null) => void;
  hoverPath: string | null;
  setHoverPath: (path: string | null) => void;
  registerFolder: (path: string, ref: HTMLDivElement | null) => void;
  checkHover: (e: MouseEvent) => void;
  documentDir: string;
};

export const DragContext = createContext<DragContextType | null>(null);

const DRAG_START_THRESHOLD_PX = 8;
const TREE_BASE_PADDING_PX = 8;
const TREE_INDENT_PX = 16;

function flattenFiles(files: (FileMetadata | Directory)[]): (FileMetadata | Directory)[] {
  return files.flatMap((f) => (f.type === "directory" ? flattenFiles(f.children) : [f]));
}

function recursiveSort(
  files: (FileMetadata | Directory)[],
  pruneEmpty = false,
): (FileMetadata | Directory)[] {
  return files
    .map((f) => {
      if (f.type === "file") return f;
      return {
        ...f,
        children: recursiveSort(f.children, pruneEmpty),
      };
    })
    .sort((a, b) => {
      return b.name.localeCompare(a.name, "en", { sensitivity: "base" });
    })
    .filter((f) => {
      return f.type === "file" || !pruneEmpty || f.children.length > 0;
    })
    .sort((a, b) => {
      return a.name.localeCompare(b.name);
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

export default function DirectoryTree({
  files,
  refreshDirectory,
  selectedFile,
  setSelectedFile,
  onRequestDelete,
  search,
  filter,
}: {
  files: (FileMetadata | Directory)[] | undefined;
  refreshDirectory: () => Promise<unknown>;
  selectedFile: FileMetadata | Directory | null;
  setSelectedFile: (file: FileMetadata | Directory | null) => void;
  onRequestDelete: (file: FileMetadata | Directory) => void;
  search: string;
  filter: string;
}) {
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

  filteredFiles = recursiveSort(filteredFiles, !!(search || filter));

  return (
    <Box className={classes.tree}>
      <Tree
        files={filteredFiles}
        refreshDirectory={refreshDirectory}
        depth={0}
        selected={selectedFile}
        setSelectedFile={setSelectedFile}
        onRequestDelete={onRequestDelete}
        expandedByDefault={!!(search || filter)}
      />
    </Box>
  );
}

function Tree({
  files,
  depth,
  refreshDirectory,
  selected,
  setSelectedFile,
  onRequestDelete,
  expandedByDefault,
}: {
  files: (FileMetadata | Directory)[];
  depth: number;
  refreshDirectory: () => Promise<unknown>;
  selected: FileMetadata | Directory | null;
  setSelectedFile: (file: FileMetadata | Directory | null) => void;
  onRequestDelete: (file: FileMetadata | Directory) => void;
  expandedByDefault?: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const { showContextMenu } = useContextMenu();

  const handleOpenFile = useCallback(
    async (record: FileMetadata) => {
      await openFile(record, setTabs, setActiveTab);
      void navigate({ to: "/" });
    },
    [setActiveTab, setTabs, navigate],
  );

  const toggleExpand = (path: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <>
      {files.map((node) => {
        const isExpanded = expandedByDefault || expandedIds.has(node.path);
        const isSelected = selected?.path === node.path;

        return (
          <DirectoryNode
            key={node.path}
            node={node}
            depth={depth}
            isSelected={isSelected}
            selectedFile={selected}
            isExpanded={isExpanded}
            setExpandedIds={setExpandedIds}
            toggleExpand={(e) => toggleExpand(node.path, e)}
            setSelectedFile={setSelectedFile}
            handleOpenFile={handleOpenFile}
            onRequestDelete={onRequestDelete}
            refreshDirectory={refreshDirectory}
            showContextMenu={showContextMenu}
          >
            {node.type === "directory" && isExpanded && node.children.length > 0 && (
              <Tree
                files={node.children}
                refreshDirectory={refreshDirectory}
                depth={depth + 1}
                selected={selected}
                setSelectedFile={setSelectedFile}
                onRequestDelete={onRequestDelete}
                expandedByDefault={expandedByDefault}
              />
            )}
          </DirectoryNode>
        );
      })}
    </>
  );
}

function DirectoryNode({
  node,
  depth,
  isSelected,
  selectedFile,
  isExpanded,
  setExpandedIds,
  toggleExpand,
  setSelectedFile,
  handleOpenFile,
  onRequestDelete,
  refreshDirectory,
  showContextMenu,
  children,
}: {
  node: FileMetadata | Directory;
  depth: number;
  isSelected: boolean;
  selectedFile: FileMetadata | Directory | null;
  isExpanded: boolean;
  setExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleExpand: (e: React.MouseEvent) => void;
  setSelectedFile: (file: FileMetadata | Directory | null) => void;
  handleOpenFile: (file: FileMetadata) => Promise<void>;
  onRequestDelete: (file: FileMetadata | Directory) => void;
  refreshDirectory: () => Promise<unknown>;
  showContextMenu: any;
  children?: React.ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const suppressClickRef = useRef(false);
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const dragContext = useContext(DragContext);

  const [isDraggingNode, setIsDraggingNode] = useState(false);

  useEffect(() => {
    if (node.type === "directory" && dragContext) {
      dragContext.registerFolder(node.path, rowRef.current);
    }
  }, [node.path, node.type, dragContext]);

  const onDragStart = (e: any) => {
    didDragRef.current = false;
    if (e && typeof e.clientX === "number" && typeof e.clientY === "number") {
      dragStartPointRef.current = { x: e.clientX, y: e.clientY };
    } else {
      dragStartPointRef.current = null;
    }
  };

  const onDragMove = (e: any) => {
    if (!dragContext) return;

    if (!didDragRef.current && dragStartPointRef.current) {
      const dx = e.clientX - dragStartPointRef.current.x;
      const dy = e.clientY - dragStartPointRef.current.y;
      const distance = Math.hypot(dx, dy);

      if (distance >= DRAG_START_THRESHOLD_PX) {
        didDragRef.current = true;
        dragContext.setDraggingPath(node.path);
        setIsDraggingNode(true);
      }
    }

    if (!didDragRef.current) {
      return;
    }

    if (!isDraggingNode) setIsDraggingNode(true);
    const evt = e as MouseEvent;
    dragContext.checkHover(evt);
  };

  const onDragStop = () => {
    if (!dragContext) return;
    const wasDragging = didDragRef.current;
    didDragRef.current = false;
    dragStartPointRef.current = null;
    setIsDraggingNode(false);
    suppressClickRef.current = wasDragging;
    if (wasDragging) {
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    dragContext.setDraggingPath(null);
    let targetId = dragContext.hoverPath;
    dragContext.setHoverPath(null);

    if (!wasDragging || !targetId) return;

    const sourcePath = node.path;
    if (sourcePath === targetId) return;

    const handleDrop = async () => {
      const separator = sep();
      if (targetId!.startsWith(sourcePath + separator)) return;

      const sourceBasename = await basename(sourcePath);
      const targetPath = await join(targetId!, sourceBasename);

      if (sourcePath === targetPath) return;

      try {
        await rename(sourcePath, targetPath);
        if (node.type !== "directory" && sourcePath.endsWith(".pgn")) {
          await rename(
            sourcePath.replace(".pgn", ".info"),
            targetPath.replace(".pgn", ".info"),
          ).catch(() => {});
        }
        await refreshDirectory();
        setExpandedIds((prev) => new Set(prev).add(targetId as string));

        if (selectedFile) {
          if (selectedFile.path === sourcePath) {
            const newName = sourceBasename.endsWith(".pgn")
              ? sourceBasename.slice(0, -4)
              : sourceBasename;
            setSelectedFile({ ...selectedFile, path: targetPath, name: newName });
          } else if (selectedFile.path.startsWith(sourcePath + separator)) {
            const trailingPath = selectedFile.path.slice(sourcePath.length + separator.length);
            const newPath = await join(targetPath, trailingPath);
            setSelectedFile({ ...selectedFile, path: newPath });
          }
        }
      } catch (err) {
        console.error("Drop failed", err);
      }
    };

    void handleDrop();
  };

  const isOver =
    dragContext?.hoverPath === node.path &&
    node.type === "directory" &&
    dragContext?.draggingPath !== node.path &&
    !node.path.startsWith(dragContext?.draggingPath + "/") &&
    !node.path.startsWith(dragContext?.draggingPath + "\\");

  return (
    <div ref={node.type === "directory" ? rowRef : null}>
      <Draggable
        position={{ x: 0, y: 0 }}
        onStart={onDragStart}
        onDrag={onDragMove}
        onStop={onDragStop}
        scale={1}
        nodeRef={rowRef as any}
      >
        <div
          ref={rowRef}
          className={clsx(classes.row, {
            [classes.selected]: isSelected,
            [classes.dragOver]: isOver,
          })}
          style={{
            paddingLeft: TREE_BASE_PADDING_PX + depth * TREE_INDENT_PX,
            opacity: isDraggingNode ? 0.5 : 1,
            zIndex: isDraggingNode ? 50 : undefined,
            position: "relative",
          }}
          onClick={(e) => {
            if (suppressClickRef.current) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }

            if (node.type === "directory") {
              toggleExpand(e);
              setSelectedFile(node);
            } else {
              setSelectedFile(node);
            }
          }}
          onDoubleClick={() => {
            if (node.type === "file") {
              void handleOpenFile(node);
            }
          }}
          onContextMenu={showContextMenu([
            {
              key: "open-file",
              icon: <IconEye size={16} />,
              disabled: node.type === "directory",
              onClick: () => {
                if (node.type === "directory") return;
                void handleOpenFile(node);
              },
            },
            {
              key: "delete-file",
              icon: <IconTrash size={16} />,
              title: "Delete",
              color: "red",
              onClick: () => {
                onRequestDelete(node);
              },
            },
          ])}
        >
          {depth > 0 && (
            <div
              aria-hidden
              className={classes.guides}
              style={{
                left: TREE_BASE_PADDING_PX + TREE_INDENT_PX / 2,
                width: depth * TREE_INDENT_PX,
              }}
            />
          )}
          <div
            className={classes.iconContainer}
            onClick={(e) => {
              if (node.type === "directory") {
                toggleExpand(e);
              }
            }}
          >
            {node.type === "directory" && (
              <IconChevronRight
                className={clsx(classes.expandIcon, {
                  [classes.expandIconRotated]: isExpanded,
                })}
              />
            )}
          </div>
          {node.type === "directory" ? (
            isExpanded ? (
              <IconFolderOpen className={classes.typeIcon} />
            ) : (
              <IconFolder className={classes.typeIcon} />
            )
          ) : (
            <FileIcon type={node.metadata.type} className={classes.typeIcon} />
          )}
          <span className={classes.label}>{node.name}</span>
          {node.type === "file" && node.metadata.type === "repertoire" && (
            <div className={classes.badge}>
              <DuePositions file={node.path} />
            </div>
          )}
        </div>
      </Draggable>
      {children}
    </div>
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
    <Badge size="xs" variant="light" leftSection={<IconTarget size={10} />}>
      {stats.due + stats.unseen}
    </Badge>
  );
}
