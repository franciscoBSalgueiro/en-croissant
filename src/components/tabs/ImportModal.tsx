import {
  Button,
  Divider,
  Modal,
  Select,
  TextInput,
  Textarea,
} from "@mantine/core";
import { open } from "@tauri-apps/api/dialog";

import { currentTabAtom } from "@/atoms/atoms";
import { parsePGN } from "@/utils/chess";
import { getChesscomGame } from "@/utils/chesscom";
import { chessopsError } from "@/utils/chessops";
import { count_pgn_games, read_games } from "@/utils/db";
import { getLichessGame } from "@/utils/lichess";
import { defaultTree, getGameName } from "@/utils/treeReducer";
import { makeFen, parseFen } from "chessops/fen";
import { useAtom } from "jotai";
import { useState } from "react";
import { match } from "ts-pattern";
import FileInput from "../common/FileInput";
import { FileMetadata } from "../files/file";

type ImportType = "PGN" | "Link" | "FEN";

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
  const [loading, setLoading] = useState(false);
  const [, setCurrentTab] = useAtom(currentTabAtom);
  const [fenError, setFenError] = useState("");

  const Input = match(importType)
    .with("PGN", () => (
      <>
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
          }}
          disabled={pgn !== ""}
          filename={file}
        />
        <Divider label="OR" labelPosition="center" />
        <Textarea
          value={pgn}
          disabled={file !== null}
          onChange={(event) => setPgn(event.currentTarget.value)}
          label="PGN game"
          data-autofocus
          rows={10}
        />
      </>
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
      <Select
        allowDeselect={false}
        label="Type of import"
        placeholder="Pick one"
        mb="lg"
        data={["PGN", "Link", "FEN"]}
        value={importType}
        onChange={(v) => setImportType(v as ImportType)}
      />

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

                fileInfo = {
                  metadata: {
                    tags: [],
                    type: "game",
                  },
                  name: file,
                  path: file,
                  numGames: count,
                };
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
