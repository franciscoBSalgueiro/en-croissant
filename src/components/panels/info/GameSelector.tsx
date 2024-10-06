import { commands } from "@/bindings";
import ConfirmModal from "@/components/common/ConfirmModal";
import { fontSizeAtom } from "@/state/atoms";
import { parsePGN } from "@/utils/chess";
import { formatNumber } from "@/utils/format";
import { getGameName } from "@/utils/treeReducer";
import { unwrap } from "@/utils/unwrap";
import { ActionIcon, Box, Group, ScrollArea, Text } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconX } from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import cx from "clsx";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import * as classes from "./GameSelector.css";

export default function GameSelector({
  games,
  setGames,
  setPage,
  total,
  path,
  activePage,
  deleteGame,
}: {
  games: Map<number, string>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
  setPage: (v: number) => void;
  total: number;
  path: string;
  activePage: number;
  deleteGame?: (index: number) => void;
}) {
  function isRowLoaded(index: number) {
    return games.has(index);
  }

  const loadMoreRows = useCallback(
    async (startIndex: number, stopIndex: number) => {
      const data = unwrap(
        await commands.readGames(path, startIndex, stopIndex),
      );
      const newGames = new Map(games);
      data.forEach(async (game, index) => {
        const { headers } = await parsePGN(game);
        newGames.set(startIndex + index, getGameName(headers));
      });
      setGames(newGames);
    },
    [games, path, setGames],
  );

  const fontSize = useAtomValue(fontSizeAtom);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: total,
    estimateSize: () => 30 * (fontSize / 100),
    getScrollElement: () => parentRef.current!,
  });

  useEffect(() => {
    if (games.size === 0) {
      loadMoreRows(0, 10);
    }
    const items = rowVirtualizer.getVirtualItems();
    if (items.some((item) => !isRowLoaded(item.index))) {
      loadMoreRows(items[0].index, items[items.length - 1].index);
    }
  }, [games.size, loadMoreRows, rowVirtualizer.getVirtualItems()]);

  return (
    <ScrollArea viewportRef={parentRef} h="100%">
      <Box
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <GameRow
            key={virtualRow.index}
            index={virtualRow.index}
            game={games.get(virtualRow.index)}
            setGames={setGames}
            setPage={setPage}
            deleteGame={deleteGame}
            activePage={activePage}
            path={path}
            total={total}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        ))}
      </Box>
    </ScrollArea>
  );
}

function GameRow({
  style,
  index,
  game,
  setPage,
  activePage,
  deleteGame,
}: {
  style?: React.CSSProperties;
  index: number;
  game: string | undefined;
  setGames: (v: Map<number, string>) => void;
  setPage: (v: number) => void;
  path: string;
  total: number;
  activePage: number;
  deleteGame?: (indxe: number) => void;
}) {
  const [deleteModal, toggleDelete] = useToggle();

  return (
    <>
      {deleteGame && (
        <ConfirmModal
          title={"Remove game"}
          description={"Are you sure you want to remove this game?"}
          opened={deleteModal}
          onClose={toggleDelete}
          onConfirm={() => {
            deleteGame(index);
            toggleDelete();
          }}
        />
      )}
      <Group
        style={style}
        justify="space-between"
        pr="xl"
        className={cx(classes.row, {
          [classes.active]: index === activePage,
        })}
      >
        <Text
          fz="sm"
          truncate
          maw={600}
          onClick={() => {
            setPage(index);
          }}
          flex={1}
        >
          {formatNumber(index + 1)}. {game}
        </Text>
        {deleteGame && (
          <Group>
            <ActionIcon
              onClick={() => toggleDelete()}
              variant="outline"
              color="red"
              size="1rem"
            >
              <IconX />
            </ActionIcon>
          </Group>
        )}
      </Group>
    </>
  );
}
