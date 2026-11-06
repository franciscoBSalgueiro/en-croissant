import { ActionIcon, Popover, Text } from "@mantine/core";
import { IconPhotoPlus } from "@tabler/icons-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";

export default function ImportImageButton({
  onImport,
  onLoadingChange,
}: {
  onImport: (fen: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function selectImage() {
    if (loading) return;
    setError("");
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: t("Import.Image"), extensions: ["png", "jpg", "jpeg", "webp", "bmp"] }],
      });
      if (typeof selected !== "string") return;
      const result = await commands.recognizeChessImage(selected);
      if (result.status === "error") throw new Error(result.error);
      onImport(`${result.data} w - - 0 1`);
    } catch (error) {
      setError(String(error));
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }

  return (
    <Popover
      opened={Boolean(error)}
      onClose={() => setError("")}
      withinPortal
      position="bottom-end"
      width={250}
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          loading={loading}
          onClick={selectImage}
          aria-label={t("Import.Image.Select")}
          title={t("Import.Image.Select")}
        >
          <IconPhotoPlus size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Text c="red" size="sm" role="alert">
          {error}
        </Text>
      </Popover.Dropdown>
    </Popover>
  );
}
