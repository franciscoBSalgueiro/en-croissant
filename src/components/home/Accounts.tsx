import { sessionsAtom } from "@/atoms/atoms";
import { getChessComAccount } from "@/utils/chesscom";
import { DatabaseInfo, getDatabases } from "@/utils/db";
import { invoke } from "@/utils/invoke";
import { getLichessAccount } from "@/utils/lichess";
import {
  Button,
  Checkbox,
  Modal,
  ScrollArea,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { listen } from "@tauri-apps/api/event";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import AccountCards from "../common/AccountCards";

function Accounts() {
  const [, setSessions] = useAtom(sessionsAtom);
  const isListesning = useRef(false);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  useEffect(() => {
    getDatabases().then((dbs) => setDatabases(dbs));
  }, []);
  const [open, setOpen] = useState(false);

  async function login(username: string) {
    await invoke("authenticate", { username });
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
    async function listen_for_code() {
      if (isListesning.current) return;
      isListesning.current = true;
      await listen<string>("access_token", async (event) => {
        const token = event.payload;
        const account = await getLichessAccount({ token });
        if (!account) return;
        setSessions((sessions) => [
          ...sessions,
          { lichess: { accessToken: token, account }, updatedAt: Date.now() },
        ]);
      });
    }

    listen_for_code();
  }, [setSessions]);

  return (
    <>
      <ScrollArea>
        <Stack>
          <AccountCards databases={databases} setDatabases={setDatabases} />
        </Stack>
      </ScrollArea>
      <Button h="2.5rem" onClick={() => setOpen(true)}>
        Add Account
      </Button>
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
            allowDeselect={false}
            label="Website"
            placeholder="Select website"
            data={[
              { label: "Lichess", value: "lichess" },
              { label: "Chess.com", value: "chesscom" },
            ]}
            value={website}
            onChange={(v) => setWebsite(v as "lichess" | "chesscom")}
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
          <Button mt="1rem" type="submit">
            Add
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
