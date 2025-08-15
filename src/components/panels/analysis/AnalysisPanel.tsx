import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  activeTabAtom,
  allEnabledAtom,
  currentExpandedEnginesAtom,
  currentThreatAtom,
  enableAllAtom,
  engineMovesFamily,
  engineProgressFamily,
  enginesAtom,
  tabEngineSettingsFamily,
} from "@/state/atoms";
import { getVariationLine } from "@/utils/chess";
import { chessopsError, getPiecesCount, hasCaptures, positionFromFen } from "@/utils/chessops";
import type { Engine } from "@/utils/engines";
import {
  Accordion,
  ActionIcon,
  Button,
  Card,
  Code,
  Collapse,
  Group,
  Paper,
  Popover,
  Progress,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  useMantineTheme,
  Box,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import {
  IconGripVertical,
  IconPlayerPause,
  IconPlayerPlay,
  IconChevronsRight,
  IconSettings,
  IconSelector,
  IconTargetArrow,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
import { memo, useCallback, useContext, useDeferredValue, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { arrowColors } from "./BestMoves";
import EngineSelection from "./EngineSelection";
import EngineSettingsForm, { type Settings } from "./EngineSettingsForm";
import ScoreBubble from "./ScoreBubble";
import TablebaseInfo from "./TablebaseInfo";
import UnifiedMovesTable from "./UnifiedMovesTable";
import { formatNodes } from "@/utils/format";
import LinesTree from "./LinesTree";
import AnalysisBar from "./AnalysisBar";

function AnalysisPanel() {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const rootFen = useStore(store, (s) => s.root.fen);
  const headers = useStore(store, (s) => s.headers);
  const currentNodeFen = useStore(
    store,
    useShallow((s) => s.currentNode().fen),
  );
  const is960 = useMemo(() => headers.variant === "Chess960", [headers]);
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position, is960)),
  );

  const [engines, setEngines] = useAtom(enginesAtom);
  const loadedEngines = useMemo(
    () => engines.filter((e) => e.loaded),
    [engines],
  );

  const [, enable] = useAtom(enableAllAtom);
  const allEnabledLoader = useAtomValue(allEnabledAtom);
  const allEnabled =
    allEnabledLoader.state === "hasData" && allEnabledLoader.data;

  const [expanded, setExpanded] = useAtom(currentExpandedEnginesAtom);
  const [pos] = positionFromFen(currentNodeFen);
  const navigate = useNavigate();

  return (
    <ScrollArea h="100%">
      <Stack gap="xs">
        {/* Tablebase info for endgames */}
        {pos &&
          (getPiecesCount(pos) <= 7 ||
            (getPiecesCount(pos) === 8 && hasCaptures(pos))) && (
            <Paper withBorder p="xs">
              <TablebaseInfo fen={currentNodeFen} turn={pos.turn} />
            </Paper>
          )}

        {/* Engine summary section */}
        {/* {loadedEngines.length > 0 && (
          <Paper withBorder p="xs">
            <Group w="100%">
              <Stack w="6rem" gap="xs">
                <Text ta="center" fw="bold" size="sm">
                  {t("Board.Analysis.Summary")}
                </Text>
                <Button
                  size="xs"
                  rightSection={
                    allEnabled ? (
                      <IconPlayerPause size="1rem" />
                    ) : (
                      <IconChevronsRight size="1rem" />
                    )
                  }
                  variant={allEnabled ? "filled" : "default"}
                  onClick={() => enable(!allEnabled)}
                >
                  {allEnabled ? t("Common.Stop") : t("Common.Run")}
                </Button>
              </Stack>
              <Group grow flex={1}>
                {loadedEngines.map((engine, i) => (
                  <EngineSummary
                    key={engine.name}
                    engine={engine}
                    fen={rootFen}
                    moves={moves}
                    i={i}
                  />
                ))}
              </Group>
            </Group>
          </Paper>
        )} */}

        {/* Individual engine configuration */}
        {loadedEngines.length > 0 && (
          <Paper withBorder p="xs">
            <Text fw="bold" size="sm" mb="xs">Engine Configuration</Text>
            <Accordion
              variant="separated"
              multiple
              chevronSize={0}
              defaultValue={loadedEngines.map((e) => e.name)}
              value={expanded}
              onChange={(v) => setExpanded(v)}
              styles={{
                label: {
                  paddingTop: 0,
                  paddingBottom: 0,
                },
                content: {
                  padding: "0.5rem",
                },
              }}
            >
              <DragDropContext
                onDragEnd={({ destination, source }) =>
                  destination?.index !== undefined &&
                  setEngines((prev) => {
                    const result = Array.from(prev);
                    const prevLoaded = result.filter((e) => e.loaded);
                    const [removed] = prevLoaded.splice(source.index, 1);
                    prevLoaded.splice(destination.index, 0, removed);

                    result.forEach((e, i) => {
                      if (e.loaded) {
                        result[i] = prevLoaded.shift()!;
                      }
                    });
                    return result;
                  })
                }
              >
                <Droppable droppableId="droppable" direction="vertical">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      <Stack w="100%">
                        {loadedEngines.map((engine, i) => (
                          <Draggable
                            key={engine.name + i.toString()}
                            draggableId={engine.name}
                            index={i}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                              >
                                <Accordion.Item value={engine.name}>
                                  <EngineConfig
                                    id={i}
                                    engine={engine}
                                    fen={rootFen}
                                    moves={moves}
                                    dragHandleProps={provided.dragHandleProps}
                                  />
                                </Accordion.Item>
                              </div>
                            )}
                          </Draggable>
                        ))}
                      </Stack>
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </Accordion>
          </Paper>
        )}

        {/* Engine controls */}
        {/* <Paper withBorder p="xs">
          <Group justify="space-between">
            <Text fw="bold" size="sm">Move Analysis</Text>
            <Group gap="xs">
              {loadedEngines.length === 0 && (
                <Button
                  size="xs"
                  rightSection={
                    allEnabled ? (
                      <IconPlayerPause size="1rem" />
                    ) : (
                      <IconChevronsRight size="1rem" />
                    )
                  }
                  variant={allEnabled ? "filled" : "default"}
                  onClick={() => enable(!allEnabled)}
                >
                  {allEnabled ? t("Common.Stop") : t("Common.Run")}
                </Button>
              )}
              <Button
                size="xs"
                variant="default"
                onClick={() => {
                  navigate({ to: "/engines" });
                }}
                leftSection={<IconSettings size="0.875rem" />}
              >
                Manage Engines
              </Button>
              <Popover width={250} position="bottom-end" shadow="md" withinPortal>
                <Popover.Target>
                  <ActionIcon variant="default" size="md">
                    <IconSelector />
                  </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown>
                  <EngineSelection />
                </Popover.Dropdown>
              </Popover>
            </Group>
          </Group>
        </Paper> */}

        <AnalysisBar height={500} />
      </Stack>
    </ScrollArea>
  );
}

function EngineSummary({
  engine,
  fen,
  moves,
  i,
}: {
  engine: Engine;
  fen: string;
  moves: string[];
  i: number;
}) {
  const activeTab = useAtomValue(activeTabAtom);
  const [ev] = useAtom(
    engineMovesFamily({ engine: engine.name, tab: activeTab! }),
  );

  const curEval = useDeferredValue(
    useMemo(() => ev.get(`${fen}:${moves.join(",")}`), [ev, fen, moves]),
  );
  const score = curEval && curEval.length > 0 ? curEval[0].score : null;

  return (
    <Card withBorder c={arrowColors[i]?.strong} p="xs">
      <Stack gap="xs" align="center">
        <Text
          fw="bold"
          fz="xs"
          style={{ textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {engine.name}
        </Text>
        <Group>
          {score ? (
            <ScoreBubble size="sm" score={score} />
          ) : (
            <Text fz="sm" c="dimmed">
              ???
            </Text>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

function EngineConfig({
  id,
  engine,
  fen,
  moves,
  dragHandleProps,
}: {
  id: number;
  engine: Engine;
  fen: string;
  moves: string[];
  dragHandleProps: any;
}) {
  const activeTab = useAtomValue(activeTabAtom);
  const theme = useMantineTheme();
  const [threat, setThreat] = useAtom(currentThreatAtom);
  const [settingsOn, toggleSettingsOn] = useToggle();

  const [engines, setEngines] = useAtom(enginesAtom);
  const [settings, setSettings2] = useAtom(
    tabEngineSettingsFamily({
      engineName: engine.name,
      defaultSettings: engine.settings ?? undefined,
      defaultGo: engine.go ?? undefined,
      tab: activeTab!,
    }),
  );

  const [ev] = useAtom(
    engineMovesFamily({ engine: engine.name, tab: activeTab! }),
  );
  const progress = useAtomValue(
    engineProgressFamily({ engine: engine.name, tab: activeTab! }),
  );

  const setSettings = useCallback(
    (fn: (prev: Settings) => Settings) => {
      const newSettings = fn(settings);
      setSettings2(newSettings);
      if (newSettings.synced) {
        setEngines((prev) =>
          prev.map((o) =>
            o.name === engine.name
              ? { ...o, settings: newSettings.settings, go: newSettings.go }
              : o,
          ),
        );
      }
    },
    [engine, settings, setSettings2, setEngines],
  );

  const engineVariations = useDeferredValue(
    useMemo(() => ev.get(`${fen}:${moves.join(",")}`), [ev, fen, moves]),
  );

  const isComputed = engineVariations && engineVariations.length > 0;
  const depth = isComputed ? engineVariations[0].depth : 0;
  const nps = isComputed ? formatNodes(engineVariations[0].nps) : 0;
  const [pos, error] = positionFromFen(fen);
  const isGameOver = pos?.isEnd() ?? false;

  return (
    <>
      <Box style={{ display: "flex" }}>
        <Stack gap={0} py="1rem">
          <ActionIcon
            size="lg"
            variant={settings.enabled ? "filled" : "transparent"}
            color={id < 4 ? arrowColors[id].strong : theme.primaryColor}
            onClick={() => {
              setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
            }}
            ml={12}
          >
            {settings.enabled ? (
              <IconPlayerPause size="1rem" />
            ) : (
              <IconPlayerPlay size="1rem" />
            )}
          </ActionIcon>
        </Stack>
        <Accordion.Control>
          <Group justify="space-between">
            <Group align="center">
              <Text fw="bold" fz="lg">
                {engine.name}
              </Text>
              {settings.enabled && !isGameOver && !error && !engineVariations && (
                <Code fz="xs">Loading...</Code>
              )}
              {progress < 100 &&
                settings.enabled &&
                !isGameOver &&
                engineVariations &&
                engineVariations.length > 0 && (
                  <Tooltip label={"How fast the engine is running"}>
                    <Code fz="xs">{nps}/s</Code>
                  </Tooltip>
                )}
              {isComputed && (
                <Tooltip label="Search depth">
                  <Code fz="xs">d{depth}</Code>
                </Tooltip>
              )}
            </Group>
            <Group>
              {isComputed && (
                <ScoreBubble size="md" score={engineVariations[0].score} />
              )}
            </Group>
          </Group>
        </Accordion.Control>
        <ActionIcon.Group>
          <Tooltip label="Check the opponent's threat">
            <ActionIcon
              size="lg"
              onClick={() => setThreat(!threat)}
              disabled={!settings.enabled}
              variant="transparent"
              mt="auto"
              mb="auto"
            >
              <IconTargetArrow color={threat ? "red" : undefined} size="1rem" />
            </ActionIcon>
          </Tooltip>
          <ActionIcon
            size="lg"
            onClick={() => toggleSettingsOn()}
            mt="auto"
            mb="auto"
          >
            <IconSettings size="1rem" />
          </ActionIcon>
          <ActionIcon
            size="lg"
            mr={8}
            mt="auto"
            mb="auto"
            style={{
              cursor: "grab",
            }}
            {...dragHandleProps}
          >
            <IconGripVertical size="1rem" />
          </ActionIcon>
        </ActionIcon.Group>
      </Box>
      
      <Collapse in={settingsOn} px={30} pb={15}>
        <EngineSettingsForm
          engine={engine}
          settings={settings}
          setSettings={setSettings}
          color={id < 4 ? arrowColors[id].strong : theme.primaryColor}
          remote={engine.type !== "local"}
        />
      </Collapse>

      <Progress
        value={isGameOver ? 0 : progress}
        animated={progress < 100 && settings.enabled && !isGameOver}
        size="xs"
        striped={progress < 100 && !settings.enabled}
        color={id < 4 ? arrowColors[id].strong : theme.primaryColor}
      />
    </>
  );
}

export default memo(AnalysisPanel);
