import { ActionIcon, Tooltip } from "@mantine/core";
import { IconFolder } from "@tabler/icons-react";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/api/shell";

function OpenFolderButton({ folder }: { folder: string }) {
  async function openAppDirData() {
    const base_path = await appDataDir();
    const path = await resolve(base_path, folder);
    open(path);
  }
  return (
    <Tooltip label="Open folder in file explorer">
      <ActionIcon onClick={() => openAppDirData()}>
        <IconFolder size={24} />
      </ActionIcon>
    </Tooltip>
  );
}

export default OpenFolderButton;
