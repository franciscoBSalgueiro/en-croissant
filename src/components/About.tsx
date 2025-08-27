import { Anchor, Modal, Text } from "@mantine/core";
import { getTauriVersion, getVersion } from "@tauri-apps/api/app";
import { version as OSVersion, arch, type } from "@tauri-apps/plugin-os";
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
      const isTauri = typeof (globalThis as any).__TAURI__ !== "undefined";
      if (isTauri) {
        try {
          const os = await type();
          const version = await getVersion();
          const tauri = await getTauriVersion();
          const architecture = await arch();
          const osVersion = await OSVersion();
          setInfo({ version, tauri, os, architecture, osVersion });
          return;
        } catch (_) {
          // fallback to web path below
        }
      }
      const ua = (navigator as any).userAgentData;
      const os = (ua?.platform || navigator.platform || "web") as string;
      const architecture = (ua?.architecture || "unknown") as string;
      const version = "web";
      const tauri = "web";
      const osVersion = "";
      setInfo({ version, tauri, os, architecture, osVersion });
    }
    load();
  }, []);
  return (
    <Modal
      centered
      opened={opened}
      onClose={() => setOpened(false)}
      title="Botvinnik"
    >
      <Text>Version: {info?.version}</Text>
      <Text>Tauri version: {info?.tauri}</Text>
      <Text>
        OS: {info?.os} {info?.architecture} {info?.osVersion}
      </Text>

      <br />

      <Anchor
        href="https://www.botvinnik.org"
        target="_blank"
        rel="noreferrer"
      >
        www.botvinnik.org
      </Anchor>
    </Modal>
  );
}

export default AboutModal;
