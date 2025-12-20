import { Anchor, Modal, Text } from "@mantine/core";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

function AboutModal({
  opened,
  setOpened,
}: {
  opened: boolean;
  setOpened: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [info, setInfo] = useState<{
    version: string;
    tauri: string;
    os: string;
    architecture: string;
    osVersion: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      if (isTauri()) {
        try {
          const { getVersion, getTauriVersion } = await import("@tauri-apps/api/app");
          const { version: OSVersion, arch, type } = await import("@tauri-apps/plugin-os");
          
          const os = await type();
          const version = await getVersion();
          const tauri = await getTauriVersion();
          const architecture = await arch();
          const osVersion = await OSVersion();
          setInfo({ version, tauri, os, architecture, osVersion });
        } catch (e) {
          console.warn("Failed to load app info:", e);
          setInfo({
            version: "Unknown",
            tauri: "Unknown",
            os: "Unknown",
            architecture: "Unknown",
            osVersion: "Unknown",
          });
        }
      } else {
        // Development mode fallback
        setInfo({
          version: "Development",
          tauri: "N/A",
          os: "Web Browser",
          architecture: "N/A",
          osVersion: "N/A",
        });
      }
    }
    load();
  }, []);
  return (
    <Modal
      centered
      opened={opened}
      onClose={() => setOpened(false)}
      title="En Croissant"
    >
      <Text>Version: {info?.version}</Text>
      <Text>Tauri version: {info?.tauri}</Text>
      <Text>
        OS: {info?.os} {info?.architecture} {info?.osVersion}
      </Text>

      <br />

      <Anchor
        href="https://www.encroissant.org"
        target="_blank"
        rel="noreferrer"
      >
        www.encroissant.org
      </Anchor>
    </Modal>
  );
}

export default AboutModal;
