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
  TextInput,
  Textarea,
} from "@mantine/core";
import { open } from "@tauri-apps/api/dialog";

import { Dirs } from "@/App";
import { currentTabAtom } from "@/atoms/atoms";
import { parsePGN } from "@/utils/chess";
import { getChesscomGame } from "@/utils/chess.com/api";
import { chessopsError } from "@/utils/chessops";
import { count_pgn_games, read_games } from "@/utils/db";
import { createFile } from "@/utils/files";
import { getLichessGame } from "@/utils/lichess/api";
import { defaultTree, getGameName } from "@/utils/treeReducer";
import { makeFen, parseFen } from "chessops/fen";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { useRouteLoaderData } from "react-router-dom";
import { match } from "ts-pattern";
import GenericCard from "../common/GenericCard";
import { FileMetadata, FileType } from "../files/file";

type ImportType = "PGN" | "Link" | "FEN";

const FILE_TYPES = [
  { label: "Game", value: "game" },
  { label: "Repertoire", value: "repertoire" },
  { label: "Tournament", value: "tournament" },
  { label: "Puzzle", value: "puzzle" },
  { label: "Other", value: "other" },
] as const;

export default function ImportModal({
  openModal,
  setOpenModal,
}: {
  openModal: boolean;
  setOpenModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
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
  const { documentDir } = useRouteLoaderData("root") as Dirs;

  const Input = match(importType)
    .with("PGN", () => (
      <Stack>
        <div>
          <FileInput
            label="PGN file"
            description={"Click to select a PGN file."}
            onClick={async () => {
              const selected = (await open({
                multiple: false,

                filters: [
                  {
                    name: "PGN file",
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
          <Divider pt="xs" label="OR" labelPosition="center" />
          <Textarea
            value={pgn}
            disabled={file !== null}
            onChange={(event) => setPgn(event.currentTarget.value)}
            label="PGN game"
            data-autofocus
            rows={8}
          />
        </div>

        <Checkbox
          label="Save to collection"
          checked={save}
          onChange={(e) => setSave(e.currentTarget.checked)}
        />

        {save && (
          <>
            <TextInput
              label="Name"
              placeholder="Enter your filename"
              required
              value={filename}
              onChange={(e) => setFilename(e.currentTarget.value)}
              error={error}
            />

            <Text fz="sm" fw="bold">
              File type
            </Text>

            <SimpleGrid cols={3}>
              {FILE_TYPES.map((v) => (
                <GenericCard
                  key={v.value}
                  id={v.value}
                  isSelected={filetype === v.value}
                  setSelected={setFiletype}
                  Header={<Text ta="center">{v.label}</Text>}
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
        label="Game URL (lichess or chess.com)"
        data-autofocus
      />
    ))
    .with("FEN", () => (
      <TextInput
        value={fen}
        onChange={(event) => setFen(event.currentTarget.value)}
        error={fenError}
        label="FEN"
        data-autofocus
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
      title="Import game"
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
          Header={<Text ta="center">Online</Text>}
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
        onClick={async () => {
          if (importType === "PGN") {
            if (file || pgn) {
              let fileInfo: FileMetadata | undefined;
              let input = pgn;
              if (file) {
                setLoading(true);
                const count = await count_pgn_games(file);
                input = (await read_games(file, 0, 0))[0];
                setLoading(false);

                const newFile = await createFile({
                  filename,
                  filetype,
                  pgn: input,
                  setError,
                  dir: documentDir,
                });
                if (!newFile) return;

                fileInfo = newFile;
              }
              const tree = await parsePGN(input);
              setCurrentTab((prev) => {
                sessionStorage.setItem(prev.value, JSON.stringify(tree));
                return {
                  ...prev,
                  name: `${getGameName(tree.headers)} (Imported)`,
                  file: fileInfo,
                  gameNumber: 0,
                  type: "analysis",
                };
              });
            }
          } else if (importType === "Link") {
            if (!link) return;
            let pgn = "";
            if (link.includes("chess.com")) {
              pgn = await getChesscomGame(link);
            } else if (link.includes("lichess")) {
              const gameId = link.split("/")[3];
              pgn = await getLichessGame(gameId);
            }

            const tree = await parsePGN(pgn);
            setCurrentTab((prev) => {
              sessionStorage.setItem(prev.value, JSON.stringify(tree));
              return {
                ...prev,
                name: `${getGameName(tree.headers)} (Imported)`,
                type: "analysis",
              };
            });
          } else if (importType === "FEN") {
            const res = parseFen(fen.trim());
            if (res.isErr) {
              setFenError(chessopsError(res.error));
              return;
            }
            setFenError("");
            const parsedFen = makeFen(res.value);
            setCurrentTab((prev) => {
              const tree = defaultTree(parsedFen);
              tree.headers.fen = parsedFen;
              sessionStorage.setItem(prev.value, JSON.stringify(tree));
              return {
                ...prev,
                name: "Analysis Board",
                type: "analysis",
              };
            });
          }
        }}
      >
        {loading ? "Importing..." : "Import"}
      </Button>
    </Modal>
  );
}
