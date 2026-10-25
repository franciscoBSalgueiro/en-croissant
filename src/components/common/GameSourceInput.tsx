import { Divider, FileInput, Group, Text, Textarea, TextInput } from "@mantine/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import GenericCard from "./GenericCard";

export type ImportType = "PGN" | "Link" | "FEN";

// Where a game comes from: a PGN file or pasted PGN, a Lichess or Chess.com link, or (if fen is
// given) a FEN. Used by Import Game and by Files › New file
export default function GameSourceInput({
  importType,
  setImportType,
  pgn,
  setPgn,
  file,
  setFile,
  link,
  setLink,
  linkError,
  fen,
  pgnPlaceholder,
  onSubmit,
}: {
  importType: ImportType;
  setImportType: (importType: ImportType) => void;
  pgn: string;
  setPgn: (pgn: string) => void;
  file: string | null;
  // name: the file's name without .pgn, or "" when the file is cleared
  setFile: (file: string | null, name: string) => void;
  link: string;
  setLink: (link: string) => void;
  linkError?: string;
  // Leave it out to offer no FEN: Files › New file saves games, and a FEN is only a position
  fen?: { value: string; setValue: (fen: string) => void; error?: string };
  pgnPlaceholder?: string;
  // Enter in the link or FEN box. Leave it out inside a form, which submits on Enter itself
  onSubmit?: () => void;
}) {
  const { t } = useTranslation();

  const Input = match(importType)
    .with("PGN", () => (
      <div>
        <FileInput
          label={t("Common.PGNFile")}
          description={t("Import.PGN.ClickToSelect")}
          onClick={async () => {
            const selected = await open({
              multiple: false,

              filters: [
                {
                  name: t("Common.PGNFile"),
                  extensions: ["pgn"],
                },
              ],
            });
            if (selected === null) return;
            setFile(
              selected,
              selected
                .split(/(\\|\/)/g)
                .pop()
                ?.replace(".pgn", "") || "",
            );
          }}
          value={new File([new Blob()], file || "")}
          onChange={(e) => {
            if (e === null) {
              setFile(null, "");
            }
          }}
          disabled={pgn !== ""}
        />
        <Divider pt="xs" label={t("Import.Or")} labelPosition="center" />
        <Textarea
          value={pgn}
          disabled={file !== null}
          onChange={(event) => setPgn(event.currentTarget.value)}
          label={t("Common.PGNGame")}
          placeholder={pgnPlaceholder}
          data-autofocus
          rows={8}
        />
      </div>
    ))
    .with("Link", () => (
      <TextInput
        value={link}
        onChange={(event) => setLink(event.currentTarget.value)}
        error={linkError}
        label={t("Import.GameURL")}
        data-autofocus
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.();
        }}
      />
    ))
    .with("FEN", () => (
      <TextInput
        value={fen?.value}
        onChange={(event) => fen?.setValue(event.currentTarget.value)}
        error={fen?.error}
        label="FEN"
        data-autofocus
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.();
        }}
      />
    ))
    .exhaustive();

  return (
    <div>
      <Group grow mb="sm">
        <GenericCard
          id={"PGN"}
          isSelected={importType === "PGN"}
          setSelected={setImportType}
          Header={<Text ta="center">PGN</Text>}
        />

        <GenericCard
          id={"Link"}
          isSelected={importType === "Link"}
          setSelected={setImportType}
          Header={<Text ta="center">{t("Import.Online")}</Text>}
        />

        {fen && (
          <GenericCard
            id={"FEN"}
            isSelected={importType === "FEN"}
            setSelected={setImportType}
            Header={<Text ta="center">FEN</Text>}
          />
        )}
      </Group>

      {Input}
    </div>
  );
}
