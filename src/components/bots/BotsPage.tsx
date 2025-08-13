import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { Route } from "@/routes/bots";
import { useNavigate } from "@tanstack/react-router";
import { botsAtom } from "@/state/atoms";
import type { Bot } from "@/utils/bots";
import { Box, Button, Divider, Group, NumberInput, Paper, ScrollArea, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import * as classes from "@/components/common/GenericCard.css";
import GenericCard from "@/components/common/GenericCard";
import AddBot from "./AddBot";
import GoModeInput from "@/components/common/GoModeInput";
import ConfirmModal from "@/components/common/ConfirmModal";

export default function BotsPage() {
  const [bots, setBots] = useAtom(botsAtom);
  const [opened, setOpened] = useState(false);
  const { selected } = Route.useSearch();
  const navigate = useNavigate();
  const setSelected = (v: number | null) => {
    navigate({ search: { selected: v ?? undefined } });
  };

  const selectedBot = selected !== undefined ? bots[selected] : null;

  useEffect(() => {
    // noop; placeholder for future logging
  }, [bots, selected]);

  return (
    <Stack h="100%" px="lg" pb="lg">
      <AddBot opened={opened} setOpened={setOpened} onAdd={(b: Bot) => setBots((prev) => [...prev, b])} />
      <Group align="baseline" py="sm">
        <Title>Bots</Title>
      </Group>
      <Group grow flex={1} style={{ overflow: "hidden" }} align="start">
        <ScrollArea h="100%" offsetScrollbars>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "md", md: "sm" }}>
            {bots.map((item, i) => {
              return (
                <GenericCard
                  id={i}
                  key={item.id}
                  isSelected={selected === i}
                  setSelected={setSelected}
                  error={undefined}
                  Header={<BotHeader bot={item} />}
                  stats={[]}
                />
              );
            })}
            <Box className={classes.card} component="button" type="button" onClick={() => setOpened(true)}>
              <Stack gap={0} justify="center" w="100%" h="100%">
                <Text mb={10}>Add New</Text>
                <Box>
                  +
                </Box>
              </Stack>
            </Box>
          </SimpleGrid>
        </ScrollArea>
        <Paper withBorder p="md" h="100%">
          {!selectedBot || selected === undefined ? (
            <Text ta="center">Select a bot</Text>
          ) : (
            <BotDetails selected={selected} setSelected={setSelected} />
          )}
        </Paper>
      </Group>
    </Stack>
  );
}

function BotHeader({ bot }: { bot: Bot }) {
  return (
    <Group wrap="nowrap">
      <Stack gap={0}>
        <Text fw="bold" lineClamp={1}>{bot.name}</Text>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {bot.go.t}
        </Text>
      </Stack>
    </Group>
  );
}

function BotDetails({ selected, setSelected }: { selected: number; setSelected: (v: number | null) => void }) {
  const [bots, setBots] = useAtom(botsAtom);
  const bot = bots[selected];
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  function setBot(newBot: Bot) {
    setBots((prev) => {
      const copy = [...prev];
      copy[selected] = newBot;
      return copy;
    });
  }

  return (
    <ScrollArea h="100%" offsetScrollbars>
      <Stack>
        <Divider variant="dashed" label="General Settings" />
        <Stack>
          <TextInput label="Name" value={bot.name} onChange={(e) => setBot({ ...bot, name: e.currentTarget.value })} />
        </Stack>
        <Divider variant="dashed" label="Search Settings" />
        <GoModeInput goMode={bot.go} setGoMode={(v) => setBot({ ...bot, go: v })} />
        <Divider variant="dashed" label="Move Selection Strategy" />
        <Stack>
          <SegmentedControl
            value={bot.strategy?.mode || "rank"}
            onChange={(v) =>
              setBot({
                ...bot,
                strategy:
                  v === "rank"
                    ? { mode: "rank", rank: bot.strategy?.mode === "rank" ? (bot.strategy as any).rank : (bot.pickRank ?? 1) }
                    : { mode: "randomTopN", topN: bot.strategy?.mode === "randomTopN" ? (bot.strategy as any).topN : 2 },
              })
            }
            data={[
              { value: "rank", label: "Nth best" },
              { value: "randomTopN", label: "Random top-N" },
            ]}
          />
          {(!bot.strategy || bot.strategy.mode === "rank") && (
            <NumberInput
              label="Pick nth best move"
              min={1}
              max={100}
              value={bot.strategy?.mode === "rank" ? (bot.strategy as any).rank : (bot.pickRank ?? 1)}
              onChange={(v) =>
                setBot({
                  ...bot,
                  strategy: { mode: "rank", rank: typeof v === "number" ? v : 1 },
                })
              }
            />
          )}
          {bot.strategy?.mode === "randomTopN" && (
            <NumberInput
              label="Top-N"
              min={1}
              max={100}
              value={(bot.strategy as any).topN}
              onChange={(v) =>
                setBot({
                  ...bot,
                  strategy: { mode: "randomTopN", topN: typeof v === "number" ? v : 2 },
                })
              }
            />
          )}
        </Stack>
        <Group justify="end">
          <Button color="red" onClick={() => setDeleteModalOpen(true)}>
            Remove
          </Button>
        </Group>
        <ConfirmModal
          title="Remove Bot"
          description="Are you sure you want to remove this bot?"
          opened={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={() => {
            setBots((prev) => {
              const copy = [...prev];
              copy.splice(selected, 1);
              return copy;
            });
            setSelected(null);
          }}
          confirmLabel="Remove"
        />
      </Stack>
    </ScrollArea>
  );
} 