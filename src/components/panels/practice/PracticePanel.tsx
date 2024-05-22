import ConfirmModal from "@/components/common/ConfirmModal";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  buildFromTree,
  getCardForReview,
  getStats,
  updateCardPerformance,
} from "@/components/files/opening";
import {
  type PracticeData,
  currentInvisibleAtom,
  currentPracticeTabAtom,
  currentTabAtom,
  deckAtomFamily,
} from "@/state/atoms";
import { findFen, getNodeAtPath } from "@/utils/treeReducer";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  RingProgress,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconArrowRight } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useContext, useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { formatDate } from "ts-fsrs";
import { useStore } from "zustand";
import RepertoireInfo from "./RepertoireInfo";

function PracticePanel() {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.currentNode().fen);
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);
  const goToMove = useStore(store, (s) => s.goToMove);
  const goToNext = useStore(store, (s) => s.goToNext);

  const currentTab = useAtomValue(currentTabAtom);
  const [resetModal, toggleResetModal] = useToggle();

  const [deck, setDeck] = useAtom(
    deckAtomFamily({
      file: currentTab?.file?.path || "",
      game: currentTab?.gameNumber || 0,
    }),
  );

  useEffect(() => {
    const newDeck = buildFromTree(
      root,
      headers.orientation || "white",
      headers.start || [],
    );
    if (newDeck.length > 0 && deck.positions.length === 0) {
      setDeck({ positions: newDeck, logs: [] });
    }
  }, [deck, root, headers, setDeck]);

  const stats = getStats(deck.positions);

  const setInvisible = useSetAtom(currentInvisibleAtom);

  async function newPractice() {
    if (deck.positions.length === 0) return;
    const c = getCardForReview(deck.positions);
    if (!c) return;
    goToMove(findFen(c.fen, root));
    setInvisible(true);
  }

  useEffect(() => {
    if (deck.logs[deck.logs.length - 1]?.rating === 4) {
      newPractice();
    }
  }, [JSON.stringify(deck)]);

  const [positionsOpen, setPositionsOpen] = useToggle();
  const [logsOpen, setLogsOpen] = useToggle();
  const [tab, setTab] = useAtom(currentPracticeTabAtom);

  useHotkeys("n", () => newPractice());

  return (
    <>
      <Tabs
        h="100%"
        orientation="vertical"
        placement="right"
        value={tab}
        onChange={(v) => setTab(v!)}
        style={{
          display: "flex",
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="train">{t("Board.Practice.Train")}</Tabs.Tab>
          <Tabs.Tab value="build">{t("Board.Practice.Build")}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="train" style={{ overflow: "hidden" }}>
          <Stack>
            {stats.total === 0 && (
              <Text>
                {t("Board.Practice.NoPositionForTrain1")} <br />
                {t("Board.Practice.NoPositionForTrain2")}
              </Text>
            )}
            {stats.total > 0 && (
              <Group wrap="nowrap">
                <RingProgress
                  size={100}
                  thickness={10}
                  label={
                    <Text ta="center" px="xs" style={{ pointerEvents: "none" }}>
                      {stats.total === 0
                        ? "0%"
                        : `${Math.round(
                            (stats.practiced / stats.total) * 100,
                          )}%`}
                    </Text>
                  }
                  sections={[
                    {
                      value: (stats.practiced / stats.total) * 100,
                      color: "blue",
                      tooltip: `practiced ${stats.practiced} positions`,
                    },
                    {
                      value: (stats.due / stats.total) * 100,
                      color: "yellow",
                      tooltip: `${stats.due} due positions`,
                    },
                    {
                      value: (stats.unseen / stats.total) * 100,
                      color: "gray",
                      tooltip: `${stats.unseen} unseen positions`,
                    },
                  ]}
                />
                <Group wrap="nowrap">
                  <Group wrap="nowrap">
                    <div>
                      <Badge color="blue">
                        {t("Board.Practice.Practiced")}
                      </Badge>
                      <Text ta="center">{stats.practiced}</Text>
                    </div>
                    <div>
                      <Badge color="yellow">{t("Board.Practice.Due")}</Badge>
                      <Text ta="center">{stats.due}</Text>
                    </div>
                    <div>
                      <Badge color="gray">{t("Board.Practice.Unseen")}</Badge>
                      <Text ta="center">{stats.unseen}</Text>
                    </div>
                  </Group>
                  <Divider orientation="vertical" />
                  <Group>
                    {stats.due === 0 && stats.unseen === 0 && (
                      <Text>
                        {t("Board.Practice.PracticedAll1")}
                        <br />
                        {t("Board.Practice.PracticedAll2")}{" "}
                        {dayjs(stats.nextDue).format("MMM D, HH:mm")}
                      </Text>
                    )}
                    <Button onClick={() => setPositionsOpen(true)}>
                      {t("Board.Practice.ShowAll")}
                    </Button>
                    <Button onClick={() => setLogsOpen(true)}>
                      {t("Board.Practice.ShowLogs")}
                    </Button>
                  </Group>
                </Group>
              </Group>
            )}

            <Group>
              <Button
                variant={
                  headers.orientation === "white" && fen.split(" ")[1] === "w"
                    ? "default"
                    : "filled"
                }
                onClick={() => newPractice()}
                disabled={stats.due === 0 && stats.unseen === 0}
              >
                <u>N</u>ext
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  const currentIndex = deck.positions.findIndex(
                    (c) => c.fen === fen,
                  );
                  if (currentIndex === -1) return;
                  updateCardPerformance(
                    setDeck,
                    currentIndex,
                    deck.positions[currentIndex].card,
                    2,
                  );
                  newPractice();
                }}
                disabled={stats.due === 0 && stats.unseen === 0}
              >
                {t("Common.Skip")}
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  setInvisible(false);
                  goToNext();
                }}
              >
                {t("Board.Practice.SeeAnser")}
              </Button>
              <Button variant="default" onClick={() => toggleResetModal()}>
                {t("Common.Reset")}
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="build" style={{ overflow: "hidden" }}>
          <RepertoireInfo />
        </Tabs.Panel>
      </Tabs>

      <ConfirmModal
        title={"Reset opening data"}
        description={`Are you sure you want to reset the opening data for "${currentTab?.file?.name}"? All the learning progress will be lost.`}
        opened={resetModal}
        onClose={toggleResetModal}
        onConfirm={() => {
          const cards = buildFromTree(
            root,
            headers.orientation || "white",
            headers.start || [],
          );
          setDeck({ positions: cards, logs: [] });
          toggleResetModal();
        }}
        confirmLabel="Reset"
      />
      <PositionsModal
        open={positionsOpen}
        setOpen={setPositionsOpen}
        deck={deck}
      />
      <LogsModal open={logsOpen} setOpen={setLogsOpen} logs={deck.logs} />
    </>
  );
}

function PositionsModal({
  open,
  setOpen,
  deck,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  deck: PracticeData;
}) {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const goToMove = useStore(store, (s) => s.goToMove);
  return (
    <Modal
      opened={open}
      onClose={() => setOpen(false)}
      size="xl"
      title={<b>Practice Positions</b>}
    >
      {deck.positions.length === 0 && (
        <Text>You haven't added any positions to practice yet.</Text>
      )}
      <SimpleGrid cols={2}>
        {deck.positions.map((c) => {
          const position = findFen(c.fen, root);
          const node = getNodeAtPath(root, position);
          return (
            <Card key={c.fen}>
              <Text>
                {Math.floor(node.halfMoves / 2) + 1}
                {node.halfMoves % 2 === 0 ? ". " : "... "}
                {c.answer}
              </Text>
              <Divider my="xs" />
              <Group justify="space-between">
                <Stack>
                  <Text tt="uppercase" fw="bold" fz="sm">
                    Status
                  </Text>
                  <Badge
                    color={
                      c.card.reps === 0
                        ? "gray"
                        : c.card.due < new Date()
                          ? "yellow"
                          : "blue"
                    }
                  >
                    {c.card.reps === 0
                      ? t("Board.Practice.Unseen")
                      : c.card.due < new Date()
                        ? t("Board.Practice.Due")
                        : t("Board.Practice.Practiced")}
                  </Badge>
                </Stack>
                <Stack>
                  <Text tt="uppercase" fw="bold" fz="sm">
                    Due
                  </Text>
                  <Text>{formatDate(c.card.due)}</Text>
                </Stack>
                <ActionIcon
                  variant="subtle"
                  onClick={() => {
                    goToMove(position);
                    setOpen(false);
                  }}
                >
                  <IconArrowRight />
                </ActionIcon>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    </Modal>
  );
}

function LogsModal({
  open,
  setOpen,
  logs,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  logs: PracticeData["logs"];
}) {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const goToMove = useStore(store, (s) => s.goToMove);
  return (
    <Modal
      opened={open}
      onClose={() => setOpen(false)}
      size="xl"
      title={<b>Practice Logs</b>}
    >
      <SimpleGrid cols={2}>
        {logs.length === 0 && <Text>No logs yet</Text>}
        {logs.map((log) => {
          const position = findFen(log.fen, root);
          const node = getNodeAtPath(root, position);

          return (
            <Card key={log.fen}>
              <Text>
                {Math.floor(node.halfMoves / 2) + 1}
                {node.halfMoves % 2 === 0 ? ". " : "... "}
                {node.san}
              </Text>

              <Divider my="xs" />
              <Group justify="space-between">
                <Stack>
                  <Text tt="uppercase" fw="bold" fz="sm">
                    Rating
                  </Text>
                  <Badge color={log.rating === 4 ? "green" : "red"}>
                    {log.rating === 4 ? "Success" : "Fail"}
                  </Badge>
                </Stack>
                <Stack>
                  <Text tt="uppercase" fw="bold" fz="sm">
                    Date
                  </Text>
                  <Text>{formatDate(log.due)}</Text>
                </Stack>
                <ActionIcon
                  variant="subtle"
                  onClick={() => {
                    goToMove(position);
                    setOpen(false);
                  }}
                >
                  <IconArrowRight />
                </ActionIcon>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    </Modal>
  );
}

export default PracticePanel;
