import { Modal, Stack, Group, Button, Text } from "@mantine/core";

function ConfirmModal({
  title,
  description,
  opened,
  onClose,
  onConfirm,
  confirmLabel,
}: {
  title: string;
  description: string;
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  return (
    <Modal withCloseButton={false} opened={opened} onClose={onClose}>
      <Stack>
        <div>
          <Text fz="lg" fw="bold" mb={10}>
            {title}
          </Text>
          <Text>{description}</Text>
          <Text>This action cannot be undone.</Text>
        </div>

        <Group position="right">
          <Button variant="default" onClick={() => onClose()}>
            Cancel
          </Button>
          <Button color="red" onClick={() => onConfirm()}>
            {confirmLabel || "Delete"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ConfirmModal;
