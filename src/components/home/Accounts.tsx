import { commands } from "@/bindings";
import type { DatabaseInfo } from "@/bindings";
import { sessionsAtom } from "@/state/atoms";
import { getChessComAccount } from "@/utils/chess.com/api";
import { getDatabases } from "@/utils/db";
import { getLichessAccount } from "@/utils/lichess/api";
import {
  Autocomplete,
  Button,
  Checkbox,
  Group,
  InputWrapper,
  Modal,
  Stack,
  TextInput,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import AccountCards from "../common/AccountCards";
import GenericCard from "../common/GenericCard";
import LichessLogo from "./LichessLogo";
import type { ChessComSession, LichessSession } from "@/utils/session";

function Accounts() {
  const [, setSessions] = useAtom(sessionsAtom);
  const isListening = useRef(false);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  useEffect(() => {
    getDatabases().then((dbs) => setDatabases(dbs));
  }, []);
  const [open, setOpen] = useState(false);

  function addChessComSession(alias: string, session: ChessComSession) {
    setSessions((sessions) => {
      const newSessions = sessions.filter(
        (s) => s.chessCom?.username !== session.username,
      );
      return [
        ...newSessions,
        {
          chessCom: session,
          player: alias,
          updatedAt: Date.now()
        },
      ];
    });
  }

  function addLichessSession(alias: string, session: LichessSession) {
    setSessions((sessions) => {
      const newSessions = sessions.filter(
        (s) => s.lichess?.username !== session.username,
      );
      return [
        ...newSessions,
        {
          lichess: session,
          player: alias,
          updatedAt: Date.now()
        },
      ];
    });
  }

  async function addChessCom(
    player: string,
    username: string
  ) {
    const p = player !== "" ? player : username;
    const stats = await getChessComAccount(username);
    if (!stats) {
      return;
    }
    addChessComSession(p, { username, stats });
  };

  async function addLichessNoLogin(
    player: string,
    username: string
  ) {
    const p = player !== "" ? player : username;
    const account = await getLichessAccount({ username });
    if (!account) return;
    addLichessSession(p, { username, account });
  }

  async function onLichessAuthentication(token: string) {
    const player = sessionStorage.getItem("lichess_player_alias") || "";
    sessionStorage.removeItem("lichess_player_alias");
    const account = await getLichessAccount({ token });
    if (!account) return;
    const username = account.username;
    const p = player !== "" ? player : username;
    addLichessSession(p, { accessToken: token, username: username, account });
  }

  async function addLichess(
    player: string,
    username: string,
    withLogin: boolean,
  ) {
    if (withLogin) {
      sessionStorage.setItem("lichess_player_alias", player);
      return await commands.authenticate(username);
    }
    return await addLichessNoLogin(player, username);
  }

  useEffect(() => {
    async function listen_for_code() {
      if (isListening.current) return;
      isListening.current = true;
      await listen<string>("access_token", async (event) => {
        const token = event.payload;
        await onLichessAuthentication(token);
      });
    }

    listen_for_code();
  }, [setSessions]);

  return (
    <>
      <AccountCards databases={databases} setDatabases={setDatabases} />
      <Group>
        <Button
          rightSection={<IconPlus size="1rem" />}
          onClick={() => setOpen(true)}
        >
          Add Account
        </Button>
      </Group>
      <AccountModal
        open={open}
        setOpen={setOpen}
        addLichess={addLichess}
        addChessCom={addChessCom}
      />
    </>
  );
}

export default Accounts;

function AccountModal({
  open,
  setOpen,
  addLichess,
  addChessCom,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  addLichess: (player: string, username: string, withLogin: boolean) => void;
  addChessCom: (player: string, username: string) => void;
}) {
  const sessions = useAtomValue(sessionsAtom);
  const [username, setUsername] = useState("");
  const [player, setPlayer] = useState<string>("");
  const [website, setWebsite] = useState<"lichess" | "chesscom">("lichess");
  const [withLogin, setWithLogin] = useState(false);

  const players = new Set(
    sessions.map(
      (s) => s.player || s.lichess?.username || s.chessCom?.username || "",
    ),
  );

  function addAccount() {
    if (website === "lichess") {
      addLichess(player, username, withLogin);
    } else {
      addChessCom(player, username);
    }
    setOpen(false);
  }

  return (
    <Modal opened={open} onClose={() => setOpen(false)} title="Add Account">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addAccount();
        }}
      >
        <Stack>
          <Autocomplete
            label="Name"
            data={Array.from(players)}
            value={player}
            onChange={(value) => setPlayer(value)}
            placeholder="Select player"
          />
          <InputWrapper label="Website" required>
            <Group grow>
              <GenericCard
                id={"lichess"}
                isSelected={website === "lichess"}
                setSelected={() => setWebsite("lichess")}
                Header={
                  <Group>
                    <LichessLogo />
                    Lichess
                  </Group>
                }
              />
              <GenericCard
                id={"chesscom"}
                isSelected={website === "chesscom"}
                setSelected={() => setWebsite("chesscom")}
                Header={
                  <Group>
                    <img
                      width={30}
                      height={30}
                      src="/chesscom.png"
                      alt="chess.com"
                    />
                    Chess.com
                  </Group>
                }
              />
            </Group>
          </InputWrapper>

          <TextInput
            label="Username"
            placeholder="Enter your username"
            required
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
          />
          {website === "lichess" && (
            <Checkbox
              label="Login with browser"
              description="Allows faster game downloads"
              checked={withLogin}
              onChange={(e) => setWithLogin(e.currentTarget.checked)}
            />
          )}
          <Button mt="1rem" type="submit">
            Add
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
