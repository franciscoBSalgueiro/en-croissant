import { Button, Group, Skeleton, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBluetooth } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { connectBoard, disconnectBoard, onBoardStatus } from "@/utils/smartboard";

export default function SmartBoardControl() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<{
    status: "disconnected" | "scanning" | "connecting" | "connected" | "error";
    device: string | null;
    message: string | null;
  } | null>(null);
  const [deviceName, setDeviceName] = useState("");

  const connected = status?.status === "connected";
  const busy = status?.status === "scanning" || status?.status === "connecting";

  useEffect(() => {
    commands.smartboardStatus().then((result) => {
      if (result.status === "ok") {
        setStatus(result.data);
      }
    });

    return onBoardStatus((boardStatusEvent) => {
      setStatus(boardStatusEvent.status);
    });
  }, []);

  const handleConnect = async () => {
    const result = await connectBoard(deviceName.trim() || undefined);
    if (result.status === "error") {
      notifications.show({
        title: t("Settings.Hardware.Error"),
        message: result.error,
        color: "red",
      });
    }
  };

  const handleDisconnect = async () => {
    const result = await disconnectBoard();
    if (result.status === "error") {
      notifications.show({
        title: t("Settings.Hardware.Error"),
        message: result.error,
        color: "red",
      });
    }
  };

  if (!status) {
    return <Skeleton width={220} />;
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <TextInput
        size="xs"
        w={180}
        placeholder={t("Settings.Hardware.DeviceName.Placeholder")}
        value={deviceName}
        disabled={connected}
        onChange={(e) => setDeviceName(e.currentTarget.value)}
      />
      {connected ? (
        <Button
          size="xs"
          variant="outline"
          color="red"
          onClick={handleDisconnect}
          leftSection={<IconBluetooth size="1rem" />}
        >
          {t("Settings.Hardware.Disconnect")}
        </Button>
      ) : (
        <Button
          size="xs"
          onClick={handleConnect}
          loading={busy}
          leftSection={<IconBluetooth size="1rem" />}
        >
          {busy ? t("Settings.Hardware.Connecting") : t("Settings.Hardware.Connect")}
        </Button>
      )}
      {status.status === "connected" && status.device && (
        <Text size="xs" c="dimmed" ta="right">
          {status.device}
        </Text>
      )}
      {status.status === "error" && status.message && (
        <Text size="xs" c="red" ta="right" w={200}>
          {status.message}
        </Text>
      )}
    </Group>
  );
}
