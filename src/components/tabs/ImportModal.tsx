import {
  Button,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useLoaderData } from "@tanstack/react-router";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { makeFen, parseFen } from "chessops/fen";
import { useAtom, useStore } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { commands } from "@/bindings";
import { addRecentFileAtom, currentTabAtom } from "@/state/atoms";
import { parsePGN } from "@/utils/chess";
import { getChesscomGame } from "@/utils/chess.com/api";
import { chessopsError } from "@/utils/chessops";
import { createFile } from "@/utils/files";
import { getLichessGame } from "@/utils/lichess/api";
import { defaultTree, getGameName } from "@/utils/treeReducer";
import { unwrap } from "@/utils/unwrap";
import GenericCard from "../common/GenericCard";
import type { FileMetadata, FileType } from "../files/file";

type ImportType = "PGN" | "Link" | "FEN";

const FILE_TYPES = [
  { label: "Files.FileType.Game", value: "game" },
  { label: "Files.FileType.Repertoire", value: "repertoire" },
  { label: "Files.FileType.Tournament", value: "tournament" },
  { label: "Files.FileType.Puzzle", value: "puzzle" },
  { label: "Files.FileType.Other", value: "other" },
] as const;

export default function ImportModal({
  openModal,
  setOpenModal,
}: {
  openModal: boolean;
  setOpenModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { t } = useTranslation();
  const [pgn, setPgn] = useState("");
  const [fen, setFen] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [importType, setImportType] = useState<ImportType>("PGN");
  const [filetype, setFiletype] = useState<FileType>("game");
  const [loading, setLoading] = useState(false);
  const [, setCurrentTab] = useAtom(currentTabAtom);
  const [fenError, setFenError] = useState("");

  const [save, setSave] = useState(false);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const { documentDir } = useLoaderData({ from: "/" });
  const store = useStore();

  async function handleSubmit() {
    setLoading(true);
    if (importType === "PGN") {
      if (file || pgn) {
        let fileInfo: FileMetadata | undefined;
        let input = pgn;
        if (file) {
          const count = unwrap(await commands.countPgnGames(file));
          const fileContent = await readTextFile(file);
          input = unwrap(await commands.readGames(file, 0, 0))[0];
          if (save) {
            const newFile = await createFile({
              filename,
              filetype,
              pgn: fileContent,
              dir: documentDir,
            });
            if (newFile.isErr) {
              setError(newFile.error.message);
              setLoading(false);
              return;
            }
            fileInfo = newFile.value;
          } else {
            fileInfo = {
              type: "file",
              path: file,
              numGames: count,
              name: filename,
              lastModified: Date.now(),
              metadata: {
                type: "game",
                tags: [],
              },
            };
          }
        }
        const tree = await parsePGN(input);
        setCurrentTab((prev) => {
          sessionStorage.setItem(
            prev.value,
            JSON.stringify({ version: 0, state: tree }),
          );
          return {
            ...prev,
            name: getGameName(tree.headers),
            file: fileInfo,
            gameNumber: 0,
            type: "analysis",
          };
        });

        if (fileInfo?.path) {
          store.set(addRecentFileAtom, {
            name: fileInfo.name,
            path: fileInfo.path,
            type: fileInfo.metadata.type,
          });
        }
      }
    } else if (importType === "Link") {
      if (!link) {
        setLoading(false);
        return;
      }
      let pgn = "";
      if (link.includes("chess.com")) {
        const res = await getChesscomGame(link);
        if (res === null) {
          setLoading(false);
          return;
        }
        pgn = res;
      } else if (link.includes("lichess")) {
        const gameId = link.split("/")[3];
        pgn = await getLichessGame(gameId);
      }

      const tree = await parsePGN(pgn);
      setCurrentTab((prev) => {
        sessionStorage.setItem(
          prev.value,
          JSON.stringify({ version: 0, state: tree }),
        );
        return {
          ...prev,
          name: getGameName(tree.headers),
          type: "analysis",
        };
      });
    } else if (importType === "FEN") {
      const res = parseFen(fen.trim());
      if (res.isErr) {
        setFenError(chessopsError(res.error));
        setLoading(false);
        return;
      }
      setFenError("");
      const parsedFen = makeFen(res.value);
      setCurrentTab((prev) => {
        const tree = defaultTree(parsedFen);
        tree.headers.fen = parsedFen;
        sessionStorage.setItem(
          prev.value,
          JSON.stringify({ version: 0, state: tree }),
        );
        return {
          ...prev,
          name: t("Home.Card.AnalysisBoard.Title"),
          type: "analysis",
        };
      });
    }
    setLoading(false);
  }

  const Input = match(importType)
    .with("PGN", () => (
      <Stack>
        <div>
          <FileInput
            label={t("Common.PGNFile")}
            description={t("Import.PGN.ClickToSelect")}
            onClick={async () => {
              const selected = (await open({
                multiple: false,
                defaultPath: "/data/chess-lab/games",
                filters: [
                  {
                    name: t("Common.PGNFile"),
                    extensions: ["pgn"],
                  },
                ],
              })) as string;
              setFile(selected);
              setFilename(
                selected
                  .split(/(\\|\/)/g)
                  .pop()
                  ?.replace(".pgn", "") || "",
              );
            }}
            value={new File([new Blob()], file || "")}
            onChange={(e) => {
              if (e === null) {
                setFile(null);
                setFilename("");
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
            data-autofocus
            rows={8}
          />
        </div>

        <Checkbox
          label={t("Import.SaveToCollection")}
          checked={save}
          onChange={(e) => setSave(e.currentTarget.checked)}
        />

        {save && (
          <>
            <TextInput
              label={t("Common.Name")}
              placeholder={t("Common.EnterFileName")}
              required
              value={filename}
              onChange={(e) => setFilename(e.currentTarget.value)}
              error={error}
            />

            <Text fz="sm" fw="bold">
              {t("Files.FileType")}
            </Text>

            <SimpleGrid cols={3}>
              {FILE_TYPES.map((v) => (
                <GenericCard
                  key={v.value}
                  id={v.value}
                  isSelected={filetype === v.value}
                  setSelected={setFiletype}
                  Header={<Text ta="center">{t(v.label)}</Text>}
                />
              ))}
            </SimpleGrid>
          </>
        )}
      </Stack>
    ))
    .with("Link", () => (
      <TextInput
        value={link}
        onChange={(event) => setLink(event.currentTarget.value)}
        label={t("Import.GameURL")}
        data-autofocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />
    ))
    .with("FEN", () => (
      <TextInput
        value={fen}
        onChange={(event) => setFen(event.currentTarget.value)}
        error={fenError}
        label="FEN"
        data-autofocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />
    ))
    .exhaustive();

  const disabled = match(importType)
    .with("PGN", () => !pgn && !file)
    .with("Link", () => !link)
    .with("FEN", () => !fen)
    .exhaustive();

  return (
    <Modal
      opened={openModal}
      onClose={() => setOpenModal(false)}
      title={t("Home.Card.ImportGame.Title")}
    >
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

        <GenericCard
          id={"FEN"}
          isSelected={importType === "FEN"}
          setSelected={setImportType}
          Header={<Text ta="center">FEN</Text>}
        />
      </Group>

      {Input}

      <Button
        fullWidth
        mt="md"
        radius="md"
        loading={loading}
        disabled={disabled}
        onClick={handleSubmit}
      >
        {loading ? t("Import.Importing") : t("Home.Card.ImportGame.Button")}
      </Button>
    </Modal>
  );
}
