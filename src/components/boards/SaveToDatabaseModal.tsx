import { Button, Group, Modal, Select, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { currentTabAtom } from "@/state/atoms";
import { getDatabases } from "@/utils/db";
import { saveToDatabase } from "@/utils/tabs";
import { TreeStateContext } from "../common/TreeStateContext";

function SaveToDatabaseModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const store = useContext(TreeStateContext)!;
  const currentOrigin = currentTab?.gameOrigin;

  const { data: databases } = useSWR("save-to-databases", () => getDatabases());
  const successDatabases = databases?.filter((db) => db.type === "success") ?? [];

  const [selected, setSelected] = useState<string | null>(
    currentOrigin?.kind === "database" ? (currentOrigin.database.split("/").pop() ?? null) : null,
  );
  const [saving, setSaving] = useState(false);

  const selectedDb = successDatabases.find((db) => db.filename === selected) ?? null;

  async function handleSave() {
    if (!selectedDb) return;
    setSaving(true);
    try {
      await saveToDatabase({
        database: selectedDb,
        tab: currentTab,
        setCurrentTab,
        store,
      });
      notifications.show({
        message: t("Board.Game.SavedToDatabase"),
        color: "green",
        icon: <IconCheck />,
      });
      onClose();
    } catch {
      // unwrap already shows an error notification
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened onClose={onClose}>
      <Stack gap="sm">
        <Text fz="lg" fw="bold">
          {t("Board.Game.SaveToDatabase")}
        </Text>
        {successDatabases.length === 0 ? (
          <Text c="dimmed">{t("Board.Game.NoDatabases")}</Text>
        ) : (
          <Select
            placeholder={t("Board.Game.SelectDatabase")}
            data={successDatabases.map((db) => ({
              value: db.filename,
              label: db.title,
            }))}
            value={selected}
            onChange={setSelected}
          />
        )}
        <Group justify="right">
          <Button variant="default" onClick={onClose}>
            {t("Common.Cancel")}
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!selectedDb || saving}>
            {t("Common.Save")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default SaveToDatabaseModal;
