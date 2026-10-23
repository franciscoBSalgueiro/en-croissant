import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import {
  Box,
  Button,
  Center,
  Checkbox,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconGripVertical, IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { togglePick } from "@/utils/homeLayout";
import type { HomeTarget } from "./HomeGrid";
import classes from "./NewTabHome.module.css";

// What a picks card shows: up to max things, the picked ones first, in the order they're dragged
// into
export default function HomePicker({
  opened,
  title,
  candidates,
  initial,
  max,
  isNew,
  onClose,
  onSave,
}: {
  opened: boolean;
  title: string;
  candidates: HomeTarget[] | undefined;
  initial: string[];
  max: number;
  isNew: boolean;
  onClose: () => void;
  onSave: (items: string[]) => void;
}) {
  const { t } = useTranslation();

  return (
    // Fading in rather than growing: a dragged row is placed wrongly inside a scaled modal
    <Modal opened={opened} onClose={onClose} title={title} transitionProps={{ transition: "fade" }}>
      {/* Remounted each time it opens, so it starts from what the card shows */}
      {opened && (
        <PickerContent
          candidates={candidates}
          initial={initial}
          max={max}
          saveLabel={isNew ? t("Common.Add") : t("Common.Save")}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Modal>
  );
}

function PickerContent({
  candidates,
  initial,
  max,
  saveLabel,
  onClose,
  onSave,
}: {
  candidates: HomeTarget[] | undefined;
  initial: string[];
  max: number;
  saveLabel: string;
  onClose: () => void;
  onSave: (items: string[]) => void;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState(initial);
  const [search, setSearch] = useState("");

  if (!candidates) {
    return (
      <Center h={120}>
        <Loader size="sm" />
      </Center>
    );
  }

  const label = (key: string) =>
    candidates.find((candidate) => candidate.key === key)?.label ??
    t("Home.Panel.NotFound", { name: key, interpolation: { escapeValue: false } });
  const query = search.trim().toLowerCase();
  const unpicked = candidates.filter(
    (candidate) =>
      !items.includes(candidate.key) &&
      (candidate.label.toLowerCase().includes(query) ||
        candidate.description?.toLowerCase().includes(query)),
  );
  const full = items.length >= max;

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        {t("Home.Pick.Description", { count: max })}
      </Text>
      {items.length > 0 && (
        <DragDropContext
          onDragEnd={({ source, destination }) => {
            if (!destination) return;
            const next = [...items];
            const [moved] = next.splice(source.index, 1);
            next.splice(destination.index, 0, moved);
            setItems(next);
          }}
        >
          <Droppable droppableId="picked">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {items.map((item, i) => (
                  <Draggable key={item} draggableId={item} index={i}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={classes.pickRow}
                      >
                        <Group gap="xs" wrap="nowrap">
                          <IconGripVertical size="1rem" style={{ flexShrink: 0, opacity: 0.5 }} />
                          <Checkbox
                            checked
                            label={label(item)}
                            onChange={() => setItems(togglePick(items, item, max))}
                          />
                        </Group>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
      <TextInput
        placeholder={t("Common.Search")}
        leftSection={<IconSearch size="1rem" />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
      <ScrollArea.Autosize mah="40vh" offsetScrollbars>
        <Stack gap={4}>
          {unpicked.length === 0 && (
            <Text size="sm" c="dimmed">
              {t("Common.NoResults")}
            </Text>
          )}
          {unpicked.map((candidate) => (
            <Box key={candidate.key} className={classes.pickRow}>
              <Checkbox
                checked={false}
                disabled={full}
                label={candidate.label}
                description={candidate.description}
                onChange={() => setItems(togglePick(items, candidate.key, max))}
              />
            </Box>
          ))}
        </Stack>
      </ScrollArea.Autosize>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          {t("Common.Cancel")}
        </Button>
        <Button disabled={items.length === 0} onClick={() => onSave(items)}>
          {saveLabel}
        </Button>
      </Group>
    </Stack>
  );
}
