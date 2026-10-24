import {
  Badge,
  Box,
  Center,
  Collapse,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconSearch } from "@tabler/icons-react";
import { type ComponentType, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HomePanelGroup, HomeTarget } from "./HomeGrid";
import classes from "./NewTabHome.module.css";

export type AddHomePanelEntry = {
  key: string;
  type: "card" | "list";
  group: HomePanelGroup;
  icon: ComponentType<{ size?: number }>;
  title: string;
  // For a kind that shows one thing, a click on what it should show adds it (undefined while
  // that's being read); otherwise a click on the kind does. null when there's no room for it.
  onAdd?: (() => void) | null;
  targeted?: boolean;
  targets?: (HomeTarget & { onAdd: (() => void) | null })[];
  noTargets?: string;
};

const GROUPS: HomePanelGroup[] = ["board", "files", "accounts", "databases"];

// Everything that isn't on the home screen yet, by group
export default function AddHomePanelModal({
  opened,
  onClose,
  entries,
}: {
  opened: boolean;
  onClose: () => void;
  entries: AddHomePanelEntry[];
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);

  const groupTitles: Record<HomePanelGroup, string> = {
    board: t("Home.Customize.Group.Board"),
    files: t("Home.Customize.Group.Files"),
    accounts: t("Home.Customize.Group.Accounts"),
    databases: t("Home.Customize.Group.Databases"),
  };
  const query = search.trim().toLowerCase();
  const matches = (text?: string) => !!text?.toLowerCase().includes(query);
  // A kind matching the search shows all it can show; otherwise just the things that match
  const shown = entries
    .map((entry) =>
      matches(entry.title) || !entry.targets
        ? entry
        : {
            ...entry,
            targets: entry.targets.filter(
              (target) => matches(target.label) || matches(target.description),
            ),
          },
    )
    .filter((entry) => matches(entry.title) || (entry.targets?.length ?? 0) > 0);

  const typeLabel = (entry: AddHomePanelEntry) =>
    entry.type === "card" ? t("Home.Customize.Card") : t("Home.Customize.List");
  const noRoom = t("Home.Customize.NoRoom");

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Home.Customize.Add")}
      onExitTransitionEnd={() => {
        setSearch("");
        setExpanded([]);
      }}
    >
      {entries.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("Home.Customize.NothingToAdd")}
        </Text>
      ) : (
        <Stack>
          <TextInput
            data-autofocus
            placeholder={t("Common.Search")}
            leftSection={<IconSearch size="1rem" />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <ScrollArea.Autosize mah="60vh" offsetScrollbars>
            <Stack gap="md">
              {shown.length === 0 && (
                <Text size="sm" c="dimmed">
                  {t("Common.NoResults")}
                </Text>
              )}
              {GROUPS.map((group) => {
                const groupEntries = shown
                  .filter((entry) => entry.group === group)
                  .sort((a, b) => a.title.localeCompare(b.title));
                if (groupEntries.length === 0) return null;
                return (
                  <Stack key={group} gap={4}>
                    <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                      {groupTitles[group]}
                    </Text>
                    {groupEntries.map((entry) => {
                      const Icon = entry.icon;
                      const kindRow = (
                        <Group wrap="nowrap" gap="sm">
                          <Box style={{ flexShrink: 0, display: "flex" }}>
                            <Icon size={24} />
                          </Box>
                          <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }}>
                            {entry.title}
                          </Text>
                          <Badge size="sm" variant="light" color="gray" style={{ flexShrink: 0 }}>
                            {typeLabel(entry)}
                          </Badge>
                        </Group>
                      );
                      if (!entry.targeted) {
                        return (
                          <AddButton
                            key={entry.key}
                            onAdd={entry.onAdd ?? null}
                            onAdded={onClose}
                            noRoom={noRoom}
                          >
                            {kindRow}
                          </AddButton>
                        );
                      }
                      const isExpanded = query !== "" || expanded.includes(entry.key);
                      return (
                        <Box key={entry.key}>
                          <UnstyledButton
                            className={classes.addEntry}
                            onClick={() =>
                              setExpanded((prev) =>
                                prev.includes(entry.key)
                                  ? prev.filter((key) => key !== entry.key)
                                  : [...prev, entry.key],
                              )
                            }
                          >
                            <Group wrap="nowrap" gap={4}>
                              {isExpanded ? (
                                <IconChevronDown size="0.9rem" style={{ flexShrink: 0 }} />
                              ) : (
                                <IconChevronRight size="0.9rem" style={{ flexShrink: 0 }} />
                              )}
                              <Box style={{ flex: 1, minWidth: 0 }}>{kindRow}</Box>
                            </Group>
                          </UnstyledButton>
                          <Collapse in={isExpanded}>
                            <Stack gap={2} pl="xl">
                              {entry.targets === undefined && (
                                <Center py="xs">
                                  <Loader size="xs" />
                                </Center>
                              )}
                              {entry.targets?.length === 0 && (
                                <Text size="xs" c="dimmed" px="sm" py={4}>
                                  {entry.noTargets}
                                </Text>
                              )}
                              {entry.targets?.map((target) => (
                                <AddButton
                                  key={target.key}
                                  onAdd={target.onAdd}
                                  onAdded={onClose}
                                  noRoom={noRoom}
                                >
                                  <Text size="sm">{target.label}</Text>
                                  {target.description && (
                                    <Text size="xs" c="dimmed">
                                      {target.description}
                                    </Text>
                                  )}
                                </AddButton>
                              ))}
                            </Stack>
                          </Collapse>
                        </Box>
                      );
                    })}
                  </Stack>
                );
              })}
            </Stack>
          </ScrollArea.Autosize>
        </Stack>
      )}
    </Modal>
  );
}

function AddButton({
  onAdd,
  onAdded,
  noRoom,
  children,
}: {
  onAdd: (() => void) | null;
  onAdded: () => void;
  noRoom: string;
  children: ReactNode;
}) {
  const button = (
    <UnstyledButton
      className={classes.addEntry}
      disabled={!onAdd}
      onClick={() => {
        onAdd?.();
        onAdded();
      }}
    >
      {children}
    </UnstyledButton>
  );

  // A disabled button gets no pointer events, so the tooltip goes on a wrapper
  return onAdd ? (
    button
  ) : (
    <Tooltip label={noRoom}>
      <div>{button}</div>
    </Tooltip>
  );
}
