import { currentTabAtom } from "@/atoms/atoms";
import { saveToFile } from "@/utils/tabs";
import { Modal, Stack, Group, Button, Text } from "@mantine/core";
import { useAtom } from "jotai";

function ConfirmChangesModal({
  opened,
  toggle,
  closeTab,
}: {
  opened: boolean;
  toggle: () => void;
  closeTab: () => void;
}) {
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);

  function save() {
    const { root, headers } = JSON.parse(
      sessionStorage.getItem(currentTab?.value || "") || "{}"
    );
    console.log(root, headers);
    saveToFile({
      setCurrentTab,
      tab: currentTab,
      headers,
      root,
    });
  }

  return (
    <Modal withCloseButton={false} opened={opened} onClose={toggle}>
      <Stack>
        <div>
          <Text fz="lg" fw="bold" mb={10}>
            Unsaved Changes
          </Text>
          <Text>
            You have unsaved changes. Do you want to save them before closing?
          </Text>
        </div>

        <Group position="right">
          <Button
            variant="default"
            onClick={() => {
              closeTab();
              toggle();
            }}
          >
            Close Without Saving
          </Button>
          <Button
            onClick={() => {
              save();
              closeTab();
              toggle();
            }}
          >
            Save and Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ConfirmChangesModal;
