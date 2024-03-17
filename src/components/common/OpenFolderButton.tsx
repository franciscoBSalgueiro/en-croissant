import { ActionIcon, Tooltip } from "@mantine/core";
import { IconFolder } from "@tabler/icons-react";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/api/shell";

function OpenFolderButton({
  base,
  folder,
}: {
  base?: "AppDir" | "Document";
  folder: string;
}) {
  async function openAppDirData() {
    let dir = folder;
    if (base === "AppDir") {
      dir = await resolve(await appDataDir(), folder);
    }
    open(dir);
  }
  return (
    <Tooltip label="Open folder in file explorer">
      <ActionIcon onClick={() => openAppDirData()}>
        <IconFolder size="1.5rem" />
      </ActionIcon>
    </Tooltip>
  );
}

export default OpenFolderButton;
