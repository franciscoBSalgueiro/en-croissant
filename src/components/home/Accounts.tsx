import {
  Button,
  Checkbox,
  Modal,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { getChessComAccount } from "../../utils/chesscom";
import { DatabaseInfo, getDatabases } from "../../utils/db";
import { createCodes, getLichessAccount } from "../../utils/lichess";
import { invoke } from "../../utils/misc";
import { Session } from "../../utils/session";
import AccountCards from "../common/AccountCards";

function Accounts() {
  const [sessions, setSessions] = useLocalStorage<Session[]>({
    key: "sessions",
    defaultValue: [],
  });
  const authWindow = useRef<Window | null>(null);
  const isListesning = useRef(false);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  useEffect(() => {
    getDatabases().then((dbs) => setDatabases(dbs));
  }, []);
  const [open, setOpen] = useState(false);

  async function listen_for_code() {
    if (isListesning.current) return;
    isListesning.current = true;
    await listen<string>("redirect_uri", async (event) => {
      if (authWindow.current) authWindow.current.close();
      const token = event.payload;
      const account = await getLichessAccount({ token });
      if (!account) return;
      setSessions((sessions) => [
        ...sessions,
        { lichess: { accessToken: token, account }, updatedAt: Date.now() },
      ]);
    });
  }

  async function login(username: string) {
    const { verifier, challenge } = await createCodes();
    const port = await invoke("start_server", {
      username,
      verifier,
    });

    authWindow.current = window.open(
      "https://lichess.org/oauth?" +
        new URLSearchParams({
          response_type: "code",
          client_id: "org.encroissant.app",
          username,
          redirect_uri: `http://localhost:${port}`,
          scope: "preference:read",
          code_challenge_method: "S256",
          code_challenge: challenge,
        }),
      "_blank"
    );
  }

  async function addLichess(username: string, withLogin: boolean) {
    if (withLogin) {
      login(username);
    } else {
      const account = await getLichessAccount({
        username,
      });
      if (!account) return;
      setSessions((sessions) => [
        ...sessions,
        { lichess: { username, account }, updatedAt: Date.now() },
      ]);
    }
  }

  useEffect(() => {
    listen_for_code();
  }, []);

  return (
    <>
      <AccountCards
        sessions={sessions}
        databases={databases}
        setDatabases={setDatabases}
        setSessions={setSessions}
      />

      <Button onClick={() => setOpen(true)}>Add Account</Button>
      <AccountModal
        open={open}
        setOpen={setOpen}
        addLichess={addLichess}
        addChessCom={(u) => {
          getChessComAccount(u).then((stats) => {
            if (!stats) return;
            setSessions((sessions) => [
              ...sessions,
              { chessCom: { username: u, stats }, updatedAt: Date.now() },
            ]);
          });
        }}
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
  addLichess: (username: string, withLogin: boolean) => void;
  addChessCom: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [website, setWebsite] = useState<"lichess" | "chesscom">("lichess");
  const [withLogin, setWithLogin] = useState(false);

  function addAccount() {
    if (website === "lichess") {
      addLichess(username, withLogin);
    } else {
      addChessCom(username);
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
          <Select
            label="Website"
            placeholder="Select website"
            data={[
              { label: "Lichess", value: "lichess" },
              { label: "Chess.com", value: "chesscom" },
            ]}
            value={website}
            onChange={(v) => setWebsite(v as any)}
            required
          />
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
              checked={withLogin}
              onChange={(e) => setWithLogin(e.currentTarget.checked)}
            />
          )}
          <Button sx={{ marginTop: "1rem" }} type="submit">
            Add
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
