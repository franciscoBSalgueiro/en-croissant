import { ActionIcon, Tooltip } from "@mantine/core";
import { IconFolder } from "@tabler/icons-react";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-shell";
import { useTranslation } from "react-i18next";

function OpenFolderButton({
  base,
  folder,
}: {
  base?: "AppDir" | "Document";
  folder: string;
}) {
  const { t } = useTranslation();

  async function openAppDirData() {
    let dir = folder;
    if (base === "AppDir") {
      dir = await resolve(await appDataDir(), folder);
    }
    open(dir);
  }
  return (
    <Tooltip label={t("Common.OpenFolder")}>
      <ActionIcon onClick={() => openAppDirData()}>
        <IconFolder size="1.5rem" />
      </ActionIcon>
    </Tooltip>
  );
}

export default OpenFolderButton;
