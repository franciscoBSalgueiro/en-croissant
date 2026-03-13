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
import Draggable, { type DraggableEvent } from "react-draggable";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import { activeTabAtom, deckAtomFamily, tabsAtom, expandedDirectoriesAtom } from "@/state/atoms";
import { openFile } from "@/utils/files";
import classes from "./DirectoryTree.module.css";
import type { Directory, FileMetadata } from "./file";
import { getStats } from "./opening";
import { FileIcon } from "./FileIcon";

type DragContextType = {
  draggingPath: string | null;
  setDraggingPath: (path: string | null) => void;
  hoverPath: string | null;
  setHoverPath: (path: string | null) => void;
  registerFolder: (path: string, ref: HTMLDivElement | null) => void;
  checkHover: (clientX: number, clientY: number) => void;
  documentDir: string;
};

export const DragContext = createContext<DragContextType | null>(null);

const DRAG_START_THRESHOLD_PX = 8;
const TREE_BASE_PADDING_PX = 8;
const TREE_INDENT_PX = 16;
type Entry = FileMetadata | Directory;
type ShowContextMenu = ReturnType<typeof useContextMenu>["showContextMenu"];

function flattenFiles(files: Entry[]): Entry[] {
  return files.flatMap((f) => (f.type === "directory" ? flattenFiles(f.children) : [f]));
}

function filterTree(files: Entry[], predicate: (file: FileMetadata) => boolean): Entry[] {
  return files
    .map((file) => {
      if (file.type === "file") {
        return predicate(file) ? file : null;
      }

      const children = filterTree(file.children, predicate);
      return children.length > 0 ? { ...file, children } : null;
    })
    .filter((file): file is Entry => file !== null);
}

function getEventPoint(event: DraggableEvent): { x: number; y: number } | null {
  if ("clientX" in event && "clientY" in event) {
    return { x: event.clientX, y: event.clientY };
  }

  if ("touches" in event && event.touches.length > 0) {
    const touch = event.touches[0];
    return { x: touch.clientX, y: touch.clientY };
  }

  return null;
}

function recursiveSort(files: Entry[], pruneEmpty = false): Entry[] {
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
  files: Entry[] | undefined;
  refreshDirectory: () => Promise<unknown>;
  selectedFile: Entry | null;
  setSelectedFile: (file: Entry | null) => void;
  onRequestDelete: (file: Entry) => void;
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

  const filteredFiles = useMemo(() => {
    let next = files ?? [];

    if (search) {
      const searchMatches = new Set(fuse.search(search).map((result) => result.item.path));
      next = filterTree(next, (file) => searchMatches.has(file.path));
    }

    if (filter) {
      next = filterTree(next, (file) => file.metadata.type === filter);
    }

    return recursiveSort(next, !!(search || filter));
  }, [files, search, filter, fuse]);

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
  files: Entry[];
  depth: number;
  refreshDirectory: () => Promise<unknown>;
  selected: Entry | null;
  setSelectedFile: (file: Entry | null) => void;
  onRequestDelete: (file: Entry) => void;
  expandedByDefault?: boolean;
}) {
  const [expandedIds, setExpandedIds] = useAtom(expandedDirectoriesAtom);
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
      const next = [...prev];
      const index = next.indexOf(path);
      if (index >= 0) {
        next.splice(index, 1);
      } else {
        next.push(path);
      }
      return next;
    });
  };

  return (
    <>
      {files.map((node) => {
        const isExpanded = expandedByDefault || expandedIds.includes(node.path);
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
  node: Entry;
  depth: number;
  isSelected: boolean;
  selectedFile: Entry | null;
  isExpanded: boolean;
  setExpandedIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleExpand: (e: React.MouseEvent) => void;
  setSelectedFile: (file: Entry | null) => void;
  handleOpenFile: (file: FileMetadata) => Promise<void>;
  onRequestDelete: (file: Entry) => void;
  refreshDirectory: () => Promise<unknown>;
  showContextMenu: ShowContextMenu;
  children?: React.ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const suppressClickRef = useRef(false);
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const dragContext = useContext(DragContext);

  const [isDraggingNode, setIsDraggingNode] = useState(false);

  useEffect(() => {
    if (!dragContext || node.type !== "directory") {
      return;
    }

    dragContext.registerFolder(node.path, rowRef.current);

    return () => {
      dragContext.registerFolder(node.path, null);
    };
  }, [node.path, node.type, dragContext]);

  const onDragStart = (e: DraggableEvent) => {
    didDragRef.current = false;
    dragStartPointRef.current = getEventPoint(e);
  };

  const onDragMove = (e: DraggableEvent) => {
    if (!dragContext) return;

    const point = getEventPoint(e);
    if (!point) {
      return;
    }

    if (!didDragRef.current && dragStartPointRef.current) {
      const dx = point.x - dragStartPointRef.current.x;
      const dy = point.y - dragStartPointRef.current.y;
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
    dragContext.checkHover(point.x, point.y);
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
        setExpandedIds((prev) => (prev.includes(targetId!) ? prev : [...prev, targetId!]));

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
    <>
      <Draggable
        position={{ x: 0, y: 0 }}
        onStart={onDragStart}
        onDrag={onDragMove}
        onStop={onDragStop}
        scale={1}
        nodeRef={rowRef as React.RefObject<HTMLElement>}
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
    </>
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
