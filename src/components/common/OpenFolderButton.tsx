import { ActionIcon, Tooltip } from "@mantine/core";
import { IconFolder } from "@tabler/icons-react";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-shell";
import { useTranslation } from "react-i18next";
import {
  getDatabasesDir,
  getEnginesDir,
  getPuzzlesDir,
} from "@/utils/directories";

function OpenFolderButton({
  base,
  folder,
}: {
  base?: "Database" | "Document" | "Engines" | "Puzzles";
  folder: string;
}) {
  const { t } = useTranslation();

  async function openAppDirData() {
    let dir = folder;
    if (base === "Database") {
      dir = await getDatabasesDir();
    }
    if (base === "Engines") {
      dir = await getEnginesDir();
    }
    if (base === "Puzzles") {
      dir = await getPuzzlesDir();
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
