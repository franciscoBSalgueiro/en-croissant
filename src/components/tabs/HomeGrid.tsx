import {
  DragDropContext,
  Draggable,
  type DragStart,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { ActionIcon, Box, Button, Card, Group, Paper, Text, Tooltip } from "@mantine/core";
import {
  IconChevronDown,
  IconChevronUp,
  IconPencil,
  IconPlus,
  IconReload,
  IconX,
} from "@tabler/icons-react";
import cx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { RESET } from "jotai/utils";
import {
  type ComponentType,
  type CSSProperties,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { homeEditModeAtom, homeLayoutAtom, showTabBarAtom } from "@/state/atoms";
import {
  addHomeCard,
  addHomeList,
  cardDropIndices,
  HOME_CARD_KINDS,
  HOME_LIST_KINDS,
  type HomeCardKind,
  type HomeListDestination,
  type HomeListKind,
  type HomePanel,
  type HomePanelKind,
  type HomeSize,
  homeCardGrid,
  homeListMoveAllowed,
  homePanelId,
  homePanels,
  isPicksKind,
  isTargetedKind,
  moveHomeCard,
  moveHomeList,
  normalizeHomeLayout,
  picksThatFit,
  removeHomePanel,
  setHomePicks,
  toggleHomeListCollapsed,
} from "@/utils/homeLayout";
import AddHomePanelModal, { type AddHomePanelEntry } from "./AddHomePanelModal";
import HomePicker from "./HomePicker";
import classes from "./NewTabHome.module.css";

export type HomePanelGroup = "board" | "files" | "accounts" | "databases";

// Something a panel can show: an account, a database, a file...
export type HomeTarget = { key: string; label: string; description?: string };

export type HomePanelDefinition = {
  group: HomePanelGroup;
  icon: ComponentType<{ size?: number }>;
  // In the "+" overlay, and on a list's title bar unless it has listTitle
  title: string;
  // A card's whole content; a list's content under its title bar
  render: (panel: HomePanel<HomePanelKind>) => ReactNode;
  listTitle?: (panel: HomePanel<HomePanelKind>) => string;
  // For a kind that shows one thing: what it can show (undefined while it's being read), and what
  // the "+" overlay says when there's nothing
  targets?: HomeTarget[];
  noTargets?: string;
  // For a picks card: what it can show
  pickFrom?: HomeTarget[];
};

// In rem, so they follow the app's font size. The smallest a list can be when one is added or
// moved: wide enough for a file name, its badge and when it was opened; tall enough for its title
// bar and two rows. (A window made smaller later shrinks the lists further.)
const MIN_LIST_WIDTH = 20;
const MIN_LIST_HEIGHT = 9;
// The smallest a card can be: its icon, title and button still fit
const MIN_CARD_SIZE = 13.5;
// The largest, so a big screen fits more cards rather than bigger ones
const MAX_CARD_SIZE = 16.5;
// Mantine's md spacing: every margin, gap and padding on the home screen (as in the styles)
const GAP = 1;

function remToPx(rem: number) {
  return rem * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
}

// The home screen's size inside its padding: measured as it's laid out, so its cards are never
// painted at the wrong size first, and again whenever it changes
function useContentSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useCallback((element: HTMLDivElement) => {
    const measure = () => {
      const style = getComputedStyle(element);
      setSize({
        width:
          element.clientWidth -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight),
        height:
          element.clientHeight -
          Number.parseFloat(style.paddingTop) -
          Number.parseFloat(style.paddingBottom),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, ...size };
}

// The number at the end of a drop area's id: its row of cards, or its column
function droppableIndex(droppableId: string) {
  return Number(droppableId.slice(droppableId.lastIndexOf("-") + 1));
}

export default function HomeGrid({
  cards,
  lists,
}: {
  cards: Record<HomeCardKind, HomePanelDefinition>;
  lists: Record<HomeListKind, HomePanelDefinition>;
}) {
  const { t } = useTranslation();
  const [savedLayout, setLayout] = useAtom(homeLayoutAtom);
  const layout = normalizeHomeLayout(savedLayout);
  const [editing, setEditing] = useAtom(homeEditModeAtom);
  const [addOpened, setAddOpened] = useState(false);
  const [draggedList, setDraggedList] = useState<{ column: number; index: number } | null>(null);
  const showTabBar = useAtomValue(showTabBarAtom);
  const { ref: homeRef, width, height } = useContentSize();
  const gap = remToPx(GAP);
  const { cardsPerRow, cardSize } = homeCardGrid(
    width,
    gap,
    remToPx(MIN_CARD_SIZE),
    remToPx(MAX_CARD_SIZE),
  );

  // Leaving the home screen ends editing
  useEffect(() => () => setEditing(false), [setEditing]);

  const rows: HomePanel<HomeCardKind>[][] = [];
  for (let i = 0; i < layout.cards.length; i += cardsPerRow) {
    rows.push(layout.cards.slice(i, i + cardsPerRow));
  }

  const size: HomeSize = {
    width,
    height,
    cardsPerRow,
    cardSize,
    gap,
    minListWidth: remToPx(MIN_LIST_WIDTH),
    minListHeight: remToPx(MIN_LIST_HEIGHT),
  };

  // While a list is dragged, the places without room for it don't take it
  function listDropAllowed(destination: HomeListDestination) {
    if (!draggedList) return true;
    return homeListMoveAllowed(layout, moveHomeList(layout, draggedList, destination), size);
  }

  function onDragStart(start: DragStart) {
    if (start.type === "list") {
      setDraggedList({
        column: droppableIndex(start.source.droppableId),
        index: start.source.index,
      });
    }
  }

  function onDragEnd({ type, source, destination }: DropResult) {
    setDraggedList(null);
    if (!destination) return;
    if (type === "card") {
      const { from, to } = cardDropIndices(
        { row: droppableIndex(source.droppableId), index: source.index },
        { row: droppableIndex(destination.droppableId), index: destination.index },
        cardsPerRow,
      );
      setLayout(moveHomeCard(layout, from, to));
      return;
    }
    const next = moveHomeList(
      layout,
      { column: droppableIndex(source.droppableId), index: source.index },
      destination.droppableId.startsWith("new-column-")
        ? { newColumn: droppableIndex(destination.droppableId) }
        : { column: droppableIndex(destination.droppableId), index: destination.index },
    );
    if (homeListMoveAllowed(layout, next, size)) {
      setLayout(next);
    }
  }

  const onScreen = new Set(homePanels(layout).map((panel) => panel.id));
  // A picks card being added (no id yet) or changed, and what it will show
  const [picking, setPicking] = useState<{
    kind: HomeCardKind;
    id?: string;
    items: string[];
  } | null>(null);

  // The layout with the panel added, or null when there's no room for it
  function withPanel(
    type: AddHomePanelEntry["type"],
    kind: HomePanelKind,
    extra: { target?: string; items?: string[] } = {},
  ) {
    const panel = { id: homePanelId(kind, extra.target), kind, ...extra };
    return type === "card"
      ? addHomeCard(layout, panel as HomePanel<HomeCardKind>, size)
      : addHomeList(layout, panel as HomePanel<HomeListKind>, size);
  }

  function entry(
    type: AddHomePanelEntry["type"],
    kind: HomePanelKind,
    definition: HomePanelDefinition,
  ): AddHomePanelEntry | null {
    const { group, icon, title } = definition;
    const shown = { key: kind, type, group, icon, title };
    if (isTargetedKind(kind)) {
      const available = definition.targets?.filter(
        (target) => !onScreen.has(homePanelId(kind, target.key)),
      );
      // Everything it can show is already on the home screen
      if (definition.targets?.length && available?.length === 0) return null;
      return {
        ...shown,
        targeted: true,
        noTargets: definition.noTargets,
        targets: available?.map((target) => {
          const next = withPanel(type, kind, { target: target.key });
          return { ...target, onAdd: next && (() => setLayout(next)) };
        }),
      };
    }
    if (isPicksKind(kind)) {
      const fits = withPanel(type, kind, { items: [] }) !== null;
      return {
        ...shown,
        onAdd: fits ? () => setPicking({ kind: kind as HomeCardKind, items: [] }) : null,
      };
    }
    if (onScreen.has(kind)) return null;
    const next = withPanel(type, kind);
    return { ...shown, onAdd: next && (() => setLayout(next)) };
  }

  const entries = [
    ...HOME_CARD_KINDS.map((kind) => entry("card", kind, cards[kind])),
    ...HOME_LIST_KINDS.map((kind) => entry("list", kind, lists[kind])),
  ].filter((e) => e !== null);

  // How many rows a Multi card has room for now (HomePanels' PicksCard: its padding, the smaller
  // padding below its rows, its border and title; then the styles' fixed row heights, an account's
  // taller for its 30px logo)
  function picksLimit(kind: HomeCardKind) {
    const chrome = remToPx(1 + 1.55 + 0.625 + 0.5) + 2;
    const row = remToPx(kind === "accountPicks" ? 2.125 : 2);
    return picksThatFit(cardSize, chrome, row, remToPx(0.125));
  }

  function savePicks(items: string[]) {
    if (!picking) return;
    if (picking.id) {
      setLayout(setHomePicks(layout, picking.id, items));
    } else {
      const next = withPanel("card", picking.kind, { items });
      if (next) setLayout(next);
    }
    setPicking(null);
  }

  const removeLabel = t("Home.Customize.Remove");
  const editPicksLabel = t("Home.Customize.EditPicks");

  return (
    <Box pos="relative" h="100%">
      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div ref={homeRef} className={cx(classes.home, { [classes.homeBelowTabBar]: showTabBar })}>
          {rows.length > 0 && (
            <div className={classes.cardRows}>
              {rows.map((row, r) => (
                <Droppable key={r} droppableId={`card-row-${r}`} type="card" direction="horizontal">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={classes.cardRow}
                    >
                      {row.map((panel, i) => (
                        <PanelSlot
                          key={panel.id}
                          id={panel.id}
                          index={i}
                          editing={editing}
                          removeLabel={removeLabel}
                          onRemove={() => setLayout(removeHomePanel(layout, panel.id))}
                          editLabel={editPicksLabel}
                          onEdit={
                            isPicksKind(panel.kind)
                              ? () =>
                                  setPicking({
                                    kind: panel.kind,
                                    id: panel.id,
                                    items: panel.items ?? [],
                                  })
                              : undefined
                          }
                          style={{ width: cardSize, height: cardSize }}
                        >
                          {cards[panel.kind].render(panel)}
                        </PanelSlot>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          )}
          {layout.columns.length > 0 && (
            <div
              className={cx(classes.columns, {
                [classes.columnsBelowCards]: rows.length > 0,
                [classes.editingColumns]: editing,
              })}
            >
              {editing && (
                <NewColumnZone
                  index={0}
                  className={classes.newFirstColumn}
                  dragging={draggedList !== null}
                  isDropDisabled={!listDropAllowed({ newColumn: 0 })}
                />
              )}
              {layout.columns.map((column, c) => (
                <Fragment key={c}>
                  <Droppable
                    droppableId={`column-${c}`}
                    type="list"
                    isDropDisabled={!listDropAllowed({ column: c, index: column.length })}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={classes.column}
                      >
                        {column.map((panel, i) => {
                          const collapsed = layout.collapsed.includes(panel.id);
                          return (
                            <PanelSlot
                              key={panel.id}
                              id={panel.id}
                              index={i}
                              editing={editing}
                              removeLabel={removeLabel}
                              onRemove={() => setLayout(removeHomePanel(layout, panel.id))}
                              className={collapsed ? classes.collapsedList : classes.expandedList}
                            >
                              <HomeList
                                title={
                                  lists[panel.kind].listTitle?.(panel) ?? lists[panel.kind].title
                                }
                                collapsed={collapsed}
                                editing={editing}
                                onToggle={() =>
                                  setLayout(toggleHomeListCollapsed(layout, panel.id))
                                }
                              >
                                {lists[panel.kind].render(panel)}
                              </HomeList>
                            </PanelSlot>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  {editing && (
                    <NewColumnZone
                      index={c + 1}
                      className={
                        c === layout.columns.length - 1 ? classes.newLastColumn : undefined
                      }
                      dragging={draggedList !== null}
                      isDropDisabled={!listDropAllowed({ newColumn: c + 1 })}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </DragDropContext>
      {editing && (
        <Paper className={classes.editBar} shadow="md" withBorder radius="md" p={6}>
          <Group gap={6} wrap="nowrap">
            <Tooltip label={t("Home.Customize.Add")}>
              <ActionIcon
                variant="light"
                size="input-sm"
                aria-label={t("Home.Customize.Add")}
                onClick={() => setAddOpened(true)}
              >
                <IconPlus size="1.1rem" />
              </ActionIcon>
            </Tooltip>
            <Button
              variant="default"
              leftSection={<IconReload size="1rem" />}
              onClick={() => setLayout(RESET)}
            >
              {t("Home.Customize.Reset")}
            </Button>
            <Button onClick={() => setEditing(false)}>{t("Home.Customize.Done")}</Button>
          </Group>
        </Paper>
      )}
      <AddHomePanelModal opened={addOpened} onClose={() => setAddOpened(false)} entries={entries} />
      <HomePicker
        opened={picking !== null}
        title={picking ? cards[picking.kind].title : ""}
        candidates={picking ? cards[picking.kind].pickFrom : []}
        initial={picking?.items ?? []}
        max={picking ? picksLimit(picking.kind) : 0}
        isNew={!picking?.id}
        onClose={() => setPicking(null)}
        onSave={savePicks}
      />
    </Box>
  );
}

// A card or list, which can be dragged and removed while editing
function PanelSlot({
  id,
  index,
  editing,
  removeLabel,
  onRemove,
  editLabel,
  onEdit,
  className,
  style,
  children,
}: {
  id: string;
  index: number;
  editing: boolean;
  removeLabel: string;
  onRemove: () => void;
  // A picks card's button to change what it shows
  editLabel?: string;
  onEdit?: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Draggable draggableId={id} index={index} isDragDisabled={!editing}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cx(classes.panel, className, { [classes.editingPanel]: editing })}
          style={{ ...style, ...provided.draggableProps.style }}
        >
          <div className={classes.panelContent}>{children}</div>
          {editing && (
            <Group gap={4} className={classes.panelButtons}>
              {onEdit && (
                <Tooltip label={editLabel}>
                  <ActionIcon
                    size="sm"
                    radius="xl"
                    variant="default"
                    aria-label={editLabel}
                    onClick={onEdit}
                  >
                    <IconPencil size="0.8rem" />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label={removeLabel}>
                <ActionIcon
                  size="sm"
                  radius="xl"
                  variant="default"
                  aria-label={removeLabel}
                  onClick={onRemove}
                >
                  <IconX size="0.8rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </div>
      )}
    </Draggable>
  );
}

function HomeList({
  title,
  collapsed,
  editing,
  onToggle,
  children,
}: {
  title: string;
  collapsed: boolean;
  editing: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Card shadow="sm" p="md" radius="md" withBorder h="100%">
      <Group
        justify="space-between"
        wrap="nowrap"
        mb={collapsed ? 0 : "xs"}
        className={editing ? undefined : classes.listHeader}
        onClick={editing ? undefined : onToggle}
      >
        <Text fw={600} size="lg" truncate>
          {title}
        </Text>
        {!editing && (
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={collapsed ? t("Home.List.Expand") : t("Home.List.Collapse")}
          >
            {collapsed ? <IconChevronDown size="1rem" /> : <IconChevronUp size="1rem" />}
          </ActionIcon>
        )}
      </Group>
      {!collapsed && <div className={classes.listBody}>{children}</div>}
    </Card>
  );
}

// While editing, the gaps between and beside the columns: a list dropped in one makes a new
// column there
function NewColumnZone({
  index,
  className,
  dragging,
  isDropDisabled,
}: {
  index: number;
  className?: string;
  dragging: boolean;
  isDropDisabled: boolean;
}) {
  return (
    <Droppable droppableId={`new-column-${index}`} type="list" isDropDisabled={isDropDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cx(classes.newColumn, className, {
            [classes.newColumnAvailable]: dragging && !isDropDisabled,
            [classes.newColumnOver]: snapshot.isDraggingOver,
          })}
        >
          {/* Kept out of the layout, so the gap doesn't widen to the dragged list */}
          <div className={classes.newColumnPlaceholder}>{provided.placeholder}</div>
        </div>
      )}
    </Droppable>
  );
}
