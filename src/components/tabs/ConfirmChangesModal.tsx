import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useLoaderData } from "@tanstack/react-router";
import equal from "fast-deep-equal";
import { useAtomValue, useStore as useAtomStore } from "jotai";
import { useContext, useEffect, useRef, useState } from "react";
import { activeTabAtom, tabsAtom } from "@/state/atoms";
import { saveToFile } from "@/utils/tabs";
import { TreeStateContext } from "../common/TreeStateContext";

function ConfirmChangesModal({
  opened,
  toggle,
  closeTab,
}: {
  opened: boolean;
  toggle: () => void;
  closeTab: () => void | boolean | Promise<void | boolean>;
}) {
  const atoms = useAtomStore();
  const sourceId = useRef(atoms.get(activeTabAtom)).current;
  const currentTab = useAtomValue(tabsAtom).find((tab) => tab.value === sourceId);
  const origin = useRef(currentTab?.gameOrigin);
  const store = useContext(TreeStateContext)!;
  const { documentDir } = useLoaderData({ from: "/" });
  const pending = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!opened) {
      pending.current = false;
      setBusy(false);
      setError(null);
      origin.current = currentTab?.gameOrigin;
    }
  }, [opened, currentTab?.gameOrigin]);

  function dismiss() {
    if (!pending.current) toggle();
  }

  async function confirm(shouldSave: boolean) {
    if (pending.current || !currentTab || atoms.get(activeTabAtom) !== sourceId) return;
    if (!equal(currentTab.gameOrigin, origin.current)) {
      setError("The game changed. Cancel this confirmation and try again.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    let completed = false;
    const tab = currentTab;
    const isCurrent = () =>
      mounted.current &&
      atoms.get(activeTabAtom) === tab.value &&
      atoms
        .get(tabsAtom)
        .some((current) => current.value === tab.value && current.gameOrigin === tab.gameOrigin);
    try {
      if (shouldSave) {
        const result = await saveToFile({
          dir: documentDir,
          tab,
          store,
          isUserSave: true,
          isCurrent,
          setCurrentTab: (update) => {
            atoms.set(tabsAtom, (tabs) =>
              tabs.map((current) =>
                current.value === tab.value
                  ? typeof update === "function"
                    ? update(current)
                    : update
                  : current,
              ),
            );
            origin.current = atoms
              .get(tabsAtom)
              .find((current) => current.value === tab.value)?.gameOrigin;
          },
        });
        if (result !== "saved") {
          if (result === "changed" && mounted.current)
            setError("The game changed while saving. Please try again.");
          return;
        }
        if (store.getState().dirty) {
          setError("The game changed while saving. Please try again.");
          return;
        }
      } else if (!isCurrent()) return;
      if (!mounted.current || atoms.get(activeTabAtom) !== tab.value) return;
      const closed = await closeTab();
      if (closed === false) return;
      completed = true;
      if (mounted.current) toggle();
    } catch (cause) {
      // unwrap already notifies native Result errors. Inline feedback also covers
      // rejected dialog, copy and transport promises without duplicate notifications.
      if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!completed) {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }

  return (
    <Modal
      withCloseButton={false}
      opened={opened}
      onClose={dismiss}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
    >
      <Stack>
        <div>
          <Text fz="lg" fw="bold" mb={10}>
            Unsaved Changes
          </Text>
          <Text>You have unsaved changes. Do you want to save them before closing?</Text>
        </div>
        {error && (
          <Text c="red" role="alert">
            {error}
          </Text>
        )}
        <Group justify="right">
          <Button variant="default" disabled={busy} onClick={() => void confirm(false)}>
            Close Without Saving
          </Button>
          <Button
            loading={busy}
            disabled={busy}
            aria-busy={busy}
            onClick={() => void confirm(true)}
          >
            Save and Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ConfirmChangesModal;
