import { useState } from "react";
import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import GoModeInput from "@/components/common/GoModeInput";
import type { GoMode } from "@/bindings";
import type { Bot } from "@/utils/bots";
import { genID } from "@/utils/tabs";
import { NumberInput } from "@mantine/core";

export default function AddBot({
  opened,
  setOpened,
  onAdd,
}: {
  opened: boolean;
  setOpened: (o: boolean) => void;
  onAdd: (b: Bot) => void;
}) {
  const [name, setName] = useState("");
  const [go, setGo] = useState<GoMode>({ t: "Depth", c: 10 });
  const [pickRank, setPickRank] = useState<number>(1);

  function create() {
    if (!name.trim()) return;
    onAdd({ id: genID(), name: name.trim(), go, pickRank });
    setOpened(false);
    setName("");
  }

  return (
    <Modal opened={opened} onClose={() => setOpened(false)} title="Add Bot">
      <Stack>
        <TextInput
          label="Name"
          placeholder="My Bot"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <GoModeInput goMode={go} setGoMode={setGo} />
        <NumberInput
          label="Pick nth best move"
          min={1}
          max={10}
          value={pickRank}
          onChange={(v) => setPickRank(typeof v === "number" ? v : 1)}
        />
        <Group justify="end">
          <Button variant="default" onClick={() => setOpened(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!name.trim()}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
} 