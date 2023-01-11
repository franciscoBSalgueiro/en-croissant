import { ActionIcon, Tooltip } from "@mantine/core";
import { IconFolder } from "@tabler/icons";
import { appDataDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/api/shell";
import path from "path";

function OpenFolderButton({ folder }: { folder: string }) {
  async function openAppDirData() {
    let base_path = await appDataDir();
    open(path.join(base_path, folder));
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
