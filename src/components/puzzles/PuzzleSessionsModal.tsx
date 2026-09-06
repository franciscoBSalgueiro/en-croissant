import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconBookmarkPlus,
  IconCheck,
  IconDeviceFloppy,
  IconPencil,
  IconPlayerPlay,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SavedPuzzleSession } from "@/bindings";
import type { Puzzle } from "@/utils/puzzles";

interface PuzzleSessionsModalProps {
  opened: boolean;
  onClose: () => void;
  sessions: SavedPuzzleSession[];
  currentPuzzles: Puzzle[];
  currentIndex: number;
  currentDb: string | null;
  onSave: () => void;
  onResume: (session: SavedPuzzleSession) => void;
  onOverwrite: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

function sessionStats(session: SavedPuzzleSession): string {
  const total = session.puzzles.length;
  if (total === 0) return "No puzzles";

  const correct = session.puzzles.filter((p) => p.completion === "correct").length;
  const completed = session.puzzles.filter((p) => p.completion !== "incomplete").length;
  const accuracy = completed > 0 ? Math.round((correct / completed) * 100) : null;

  const parts: string[] = [`${total} puzzle${total !== 1 ? "s" : ""}`];
  if (accuracy !== null) parts.push(`${accuracy}% accuracy`);
  const incomplete = session.puzzles.filter((p) => p.completion === "incomplete").length;
  if (incomplete > 0) parts.push(`${incomplete} remaining`);

  return parts.join(" · ");
}

function formatSavedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PuzzleSessionsModal({
  opened,
  onClose,
  sessions,
  currentPuzzles,
  currentIndex,
  currentDb,
  onSave,
  onResume,
  onOverwrite,
  onRename,
  onDelete,
}: PuzzleSessionsModalProps) {
  const { t } = useTranslation();
  const hasActiveSession = currentPuzzles.length > 0;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function startEdit(session: SavedPuzzleSession) {
    setEditingId(session.id);
    setEditingName(session.name);
  }

  function commitEdit() {
    if (editingId && editingName.trim()) {
      onRename(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") cancelEdit();
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Puzzle.SavedSessions", "Saved Sessions")}
      size="md"
    >
      <Stack gap="md">
        <Button
          leftSection={<IconBookmarkPlus size={16} />}
          variant="light"
          disabled={!hasActiveSession}
          onClick={onSave}
          fullWidth
        >
          {t("Puzzle.SaveCurrentSession", "Save current session")}
          {hasActiveSession && (
            <Text span c="dimmed" size="sm" ml={6}>
              ({currentPuzzles.length} puzzle{currentPuzzles.length !== 1 ? "s" : ""}, #
              {currentIndex + 1})
            </Text>
          )}
        </Button>

        {sessions.length === 0 ? (
          <Text c="dimmed" ta="center" size="sm" py="md">
            {t(
              "Puzzle.NoSavedSessions",
              "No saved sessions yet. Save your current session to resume it later.",
            )}
          </Text>
        ) : (
          <>
            <Divider label={t("Puzzle.SavedSessions", "Saved sessions")} labelPosition="center" />
            <ScrollArea.Autosize mah={420} scrollbars="y" type="never">
              <Stack gap="md">
                {sessions.map((session) => {
                  const isEditing = editingId === session.id;
                  return (
                    <Paper key={session.id} withBorder p="sm" radius="sm">
                      <Group justify="space-between" wrap="nowrap" align="flex-start">
                        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                          {isEditing ? (
                            <Group gap="xs" wrap="nowrap">
                              <TextInput
                                value={editingName}
                                onChange={(e) => setEditingName(e.currentTarget.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={commitEdit}
                                size="xs"
                                style={{ flex: 1 }}
                                autoFocus
                              />
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="teal"
                                onMouseDown={commitEdit}
                              >
                                <IconCheck size={14} />
                              </ActionIcon>
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="gray"
                                onMouseDown={cancelEdit}
                              >
                                <IconX size={14} />
                              </ActionIcon>
                            </Group>
                          ) : (
                            <Group gap={4} wrap="nowrap">
                              <Text fw={500} size="sm" truncate style={{ flex: 1 }}>
                                {session.name}
                              </Text>
                              <Tooltip label={t("Common.Rename", "Rename")}>
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  color="gray"
                                  onClick={() => startEdit(session)}
                                >
                                  <IconPencil size={12} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          )}
                          <Text c="dimmed" size="xs">
                            {formatSavedAt(session.savedAt)}
                          </Text>
                          <Text c="dimmed" size="xs" truncate>
                            {sessionStats(session)}
                          </Text>
                          {session.dbPath && (
                            <Text c="dimmed" size="xs" truncate>
                              {session.dbPath.split(/[/\\]/).pop()?.replace(".db3", "")}
                            </Text>
                          )}
                        </Stack>
                        <Group gap="xs" wrap="nowrap" mt={2}>
                          <Tooltip label={t("Puzzle.ResumeSession", "Resume session")}>
                            <ActionIcon
                              variant="light"
                              color="teal"
                              onClick={() => onResume(session)}
                            >
                              <IconPlayerPlay size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip
                            label={t("Puzzle.OverwriteSession", "Overwrite with current session")}
                          >
                            <ActionIcon
                              variant="light"
                              color="blue"
                              disabled={!hasActiveSession}
                              onClick={() => onOverwrite(session.id)}
                            >
                              <IconDeviceFloppy size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t("Common.Delete", "Delete")}>
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => onDelete(session.id)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
          </>
        )}
      </Stack>
    </Modal>
  );
}

export default PuzzleSessionsModal;
