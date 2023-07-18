import {
  Button,
  Divider,
  Modal,
  Select,
  TextInput,
  Textarea,
} from "@mantine/core";
import { open } from "@tauri-apps/api/dialog";

import { useState } from "react";
import { parsePGN } from "@/utils/chess";
import { getChesscomGame } from "@/utils/chesscom";
import { count_pgn_games, read_games } from "@/utils/db";
import { getLichessGame } from "@/utils/lichess";
import { FileInfo } from "@/utils/tabs";
import FileInput from "../common/FileInput";
import { useAtom } from "jotai";
import { currentTabAtom } from "@/atoms/atoms";

export default function ImportModal({
  openModal,
  setOpenModal,
}: {
  openModal: boolean;
  setOpenModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [pgn, setPgn] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [importType, setImportType] = useState<string>("PGN");
  const [loading, setLoading] = useState(false);
  const [, setCurrentTab] = useAtom(currentTabAtom);

  return (
    <Modal
      opened={openModal}
      onClose={() => setOpenModal(false)}
      title="Import game"
    >
      <Select
        label="Type of import"
        placeholder="Pick one"
        mb="lg"
        data={[
          { value: "PGN", label: "PGN" },
          { value: "Link", label: "Link" },
        ]}
        value={importType}
        onChange={(v) => setImportType(v as string)}
      />

      {importType === "PGN" && (
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
            minRows={10}
          />
        </>
      )}

      {importType === "Link" && (
        <TextInput
          value={link}
          onChange={(event) => setLink(event.currentTarget.value)}
          label="Game URL (lichess or chess.com)"
          data-autofocus
        />
      )}

      <Button
        fullWidth
        mt="md"
        radius="md"
        loading={loading}
        disabled={importType === "PGN" ? !pgn && !file : !link}
        onClick={async () => {
          if (importType === "PGN") {
            if (file || pgn) {
              let fileInfo: FileInfo | undefined;
              let input = pgn;
              if (file) {
                setLoading(true);
                const count = await count_pgn_games(file);
                input = (await read_games(file, 0, 0))[0];
                setLoading(false);

                fileInfo = {
                  path: file,
                  numGames: count,
                };
              }
              const tree = await parsePGN(input);
              setCurrentTab((prev) => {
                sessionStorage.setItem(prev.value, JSON.stringify(tree));
                return {
                  ...prev,
                  name: `${tree.headers.white.name} - ${tree.headers.black.name} (Imported)`,
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
                name: `${tree.headers.white.name} - ${tree.headers.black.name} (Imported)`,
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
