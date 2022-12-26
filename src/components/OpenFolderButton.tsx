import { ActionIcon } from "@mantine/core";
import { IconFolder } from "@tabler/icons";
import { appDataDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/tauri";

function OpenFolderButton({ path }: { path: string }) {
  async function openAppDirData() {
    let base_path = await appDataDir();
    invoke("externalOpen", { path: base_path + "/" + path });
  }
  return (
    <ActionIcon onClick={() => openAppDirData()}>
      <IconFolder size={24} />
    </ActionIcon>
  );
}

export default OpenFolderButton;
