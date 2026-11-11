import {
  Alert,
  Button,
  Code,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { INITIAL_FEN } from "chessops/fen";
import { useAtom, useSetAtom, useStore } from "jotai";
import { useState } from "react";
import useSWR from "swr";
import { loadOpeningCatalog, downloadOpeningCatalog } from "@/utils/openingCatalogDownload";
import { useTranslation } from "react-i18next";
import { activeTabAtom, addRecentFileAtom, tabFamily, tabsAtom } from "@/state/atoms";
import { headersToPGN } from "@/utils/chess";
import { createFile } from "@/utils/files";
import { createTab } from "@/utils/tabs";
import {
  openingContinuations,
  openingRepertoirePgn,
  openingRepertoireName,
} from "@/utils/openingCatalog";

export default function CreateRepertoireModal({
  opened,
  setOpened,
}: {
  opened: boolean;
  setOpened: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [color, setColor] = useState<"white" | "black">("white");
  const [error, setError] = useState("");
  const [mode, setMode] = useState("catalog");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [includeContinuations, setIncludeContinuations] = useState(false);
  const [creating, setCreating] = useState(false);
  const {
    data: catalog,
    isLoading: catalogLoading,
    mutate: setCatalog,
  } = useSWR(opened && mode === "catalog" ? "opening-catalog" : null, loadOpeningCatalog, {
    revalidateOnFocus: false,
  });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const openingCatalog = catalog?.openings ?? [];
  const catalogLines = catalog?.lines ?? [];
  const selectedOpening = openingCatalog.find((opening) => opening.id === openingId);
  const lineCount =
    selectedOpening && includeContinuations
      ? openingContinuations(selectedOpening, catalogLines).length
      : 1;
  const trainable =
    selectedOpening &&
    (selectedOpening.moves.length >= (color === "black" ? 2 : 1) ||
      (includeContinuations &&
        openingContinuations(selectedOpening, catalogLines).some(
          (opening) => opening.moves.length >= (color === "black" ? 2 : 1),
        )));
  const { documentDir } = useLoaderData({ from: "/" });

  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const store = useStore();
  const navigate = useNavigate();

  async function handleCreate() {
    if (creating) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("Common.RequireName"));
      return;
    }

    if (mode === "catalog" && !trainable) {
      setError(t("OpeningCatalog.SelectRequired"));
      return;
    }
    setCreating(true);
    try {
      const pgn =
        mode === "catalog" && selectedOpening
          ? openingRepertoirePgn({
              name: trimmedName,
              color,
              opening: selectedOpening,
              includeContinuations,
              catalogLines,
            })
          : headersToPGN({
              id: 0,
              fen: INITIAL_FEN,
              black: "",
              white: "",
              result: "*",
              event: trimmedName,
              site: "",
              orientation: color,
            });

      const result = await createFile({
        filename: trimmedName,
        filetype: "repertoire",
        pgn,
        dir: documentDir,
      });

      if (result.isErr) {
        setError(result.error.message);
        return;
      }

      const fileInfo = result.value;
      const id = await createTab({
        tab: {
          name: trimmedName,
          type: "analysis",
        },
        setTabs,
        setActiveTab,
        pgn,
        gameOrigin: {
          kind: "file",
          file: fileInfo,
          gameNumber: 0,
        },
      });

      store.set(tabFamily(id), "practice");
      store.set(addRecentFileAtom, {
        name: trimmedName,
        path: fileInfo.path,
        type: "repertoire",
      });
      navigate({ to: "/" });

      setName("");
      setColor("white");
      setError("");
      setOpeningId(null);
      setIncludeContinuations(false);
      setOpened(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("Home.Card.NewRepertoire.Title")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleCreate();
        }}
      >
        <Stack>
          <SegmentedControl
            fullWidth
            value={mode}
            onChange={setMode}
            disabled={creating}
            data={[
              { label: t("OpeningCatalog.FromCatalog"), value: "catalog" },
              { label: t("OpeningCatalog.EmptyRepertoire"), value: "empty" },
            ]}
          />
          {mode === "catalog" && (
            <>
              {!catalog && (
                <>
                  <Text size="sm">{t("OpeningCatalog.DownloadDescription")}</Text>
                  <Button
                    loading={downloading || catalogLoading}
                    onClick={async () => {
                      setDownloading(true);
                      setDownloadError("");
                      try {
                        await setCatalog(await downloadOpeningCatalog(), { revalidate: false });
                      } catch (cause) {
                        setDownloadError(cause instanceof Error ? cause.message : String(cause));
                      } finally {
                        setDownloading(false);
                      }
                    }}
                  >
                    {t("OpeningCatalog.Download")}
                  </Button>
                </>
              )}
              {downloadError && <Alert color="red">{downloadError}</Alert>}
              <Select
                label={t("OpeningCatalog.Opening")}
                placeholder={t("OpeningCatalog.Search")}
                searchable
                clearable
                limit={50}
                disabled={creating || !catalog}
                data={openingCatalog.map((opening) => ({
                  value: opening.id,
                  label: `${opening.eco} · ${opening.name}`,
                }))}
                value={openingId}
                nothingFoundMessage={t("OpeningCatalog.NoResults")}
                onChange={(value) => {
                  const opening = openingCatalog.find((entry) => entry.id === value);
                  if (!name || (selectedOpening && name === openingRepertoireName(selectedOpening)))
                    setName(opening ? openingRepertoireName(opening) : "");
                  setOpeningId(value);
                  setError("");
                }}
              />
              {selectedOpening && (
                <>
                  <Code block style={{ whiteSpace: "normal" }}>
                    {selectedOpening.pgn}
                  </Code>
                  <Switch
                    checked={includeContinuations}
                    onChange={(event) => setIncludeContinuations(event.currentTarget.checked)}
                    label={t("OpeningCatalog.IncludeContinuations")}
                    disabled={creating}
                  />
                  <Text size="sm" c="dimmed">
                    {t("OpeningCatalog.LineCount", { count: lineCount })}
                  </Text>
                </>
              )}
              {selectedOpening && !trainable && (
                <Alert color="orange">{t("OpeningCatalog.NoMovesForColor")}</Alert>
              )}
              <Text size="xs" c="dimmed">
                {t("OpeningCatalog.Source")}
              </Text>
            </>
          )}
          <TextInput
            label={t("Common.Name")}
            placeholder={t("Home.Card.NewRepertoire.NamePlaceholder")}
            value={name}
            onChange={(e) => {
              setName(e.currentTarget.value);
              if (error) setError("");
            }}
            error={error}
            data-autofocus
            disabled={creating}
          />

          <div>
            <Text size="sm" fw={500} mb={4}>
              {t("Home.Card.NewRepertoire.Color")}
            </Text>
            <SegmentedControl
              fullWidth
              value={color}
              disabled={creating}
              onChange={(v) => setColor(v as "white" | "black")}
              data={[
                { label: t("Common.WHITE"), value: "white" },
                { label: t("Common.BLACK"), value: "black" },
              ]}
            />
          </div>

          {error && <Alert color="red">{error}</Alert>}
          <Button type="submit" loading={creating} disabled={mode === "catalog" && !trainable}>
            {t("Common.Create")}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
