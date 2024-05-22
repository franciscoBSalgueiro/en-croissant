import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  return (
    <Modal withCloseButton={false} opened={opened} onClose={onClose}>
      <Stack>
        <div>
          <Text fz="lg" fw="bold" mb={10}>
            {title}
          </Text>
          <Text>{description}</Text>
          <Text>{t("Common.CannotUndo")}</Text>
        </div>

        <Group justify="right">
          <Button variant="default" onClick={() => onClose()}>
            {t("Common.Cancel")}
          </Button>
          <Button color="red" onClick={() => onConfirm()}>
            {confirmLabel || t("Common.Delete")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ConfirmModal;
