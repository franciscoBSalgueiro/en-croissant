import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useLoaderData } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { tabsAtom } from "@/state/atoms";
import type { TreeStore } from "@/state/store/tree";
import { saveToFile, type Tab } from "@/utils/tabs";

function ConfirmChangesModal({
  opened,
  onClose,
  onConfirm,
  tab,
  getStore,
}: {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tab: Tab;
  getStore: () => TreeStore | undefined;
}) {
  const setTabs = useSetAtom(tabsAtom);
  const { documentDir } = useLoaderData({ from: "/" });
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  function dismiss() {
    setSaveFailed(false);
    onClose();
  }

  function confirm() {
    onConfirm();
    dismiss();
  }

  async function saveAndConfirm() {
    setSaving(true);
    setSaveFailed(false);
    let saved: boolean;
    try {
      const store = getStore();
      if (!store) {
        setSaveFailed(true);
        return;
      }
      saved = await saveToFile({
        dir: documentDir,
        setTabs,
        tab,
        store,
        isUserSave: true,
      });
    } catch {
      setSaveFailed(true);
      return;
    } finally {
      setSaving(false);
    }
    if (saved) confirm();
  }

  return (
    <Modal
      withCloseButton={false}
      opened={opened}
      onClose={dismiss}
      closeOnEscape={!saving}
      closeOnClickOutside={!saving}
    >
      <Stack>
        <div>
          <Text fz="lg" fw="bold" mb={10}>
            Unsaved Changes
          </Text>
          <Text>You have unsaved changes. Do you want to save them before closing?</Text>
        </div>

        {saveFailed && (
          <Text role="alert" c="red">
            Could not save changes. Please try again.
          </Text>
        )}
        <Group justify="right">
          <Button variant="default" disabled={saving} onClick={confirm}>
            Close Without Saving
          </Button>
          <Button loading={saving} onClick={saveAndConfirm}>
            Save and Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ConfirmChangesModal;
