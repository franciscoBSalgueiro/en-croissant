import { MantineProvider, type FileInputProps } from "@mantine/core";
import { open } from "@tauri-apps/plugin-dialog";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ImportModal from "../ImportModal";

const picker = vi.hoisted(() => ({ click: undefined as (() => Promise<void>) | undefined }));
vi.mock("@mantine/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@mantine/core")>();
  return {
    ...original,
    FileInput: (props: FileInputProps) => {
      picker.click = props.onClick as () => Promise<void>;
      return <span data-testid="picked-file">{props.value?.name}</span>;
    },
  };
});
vi.mock("@tanstack/react-router", () => ({ useLoaderData: () => ({ documentDir: "/games" }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn<typeof open>() }));

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "matchMedia",
    vi.fn<typeof matchMedia>(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  );
  localStorage.clear();
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <Provider store={createStore()}>
        <MantineProvider env="test">
          <ImportModal
            openModal
            setOpenModal={() => {}}
            setTabs={() => {}}
            setActiveTab={() => {}}
          />
        </MantineProvider>
      </Provider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function choose(path: string | null) {
  vi.mocked(open).mockResolvedValueOnce(path);
  await act(async () => {
    await expect(picker.click!()).resolves.toBeUndefined();
  });
}

function selectedFile() {
  return document.querySelector('[data-testid="picked-file"]')?.textContent;
}

test("cancelling an empty picker does not throw and permits a later selection", async () => {
  await choose(null);
  expect(selectedFile()).toBe("");
  await choose("/games/first.pgn");
  expect(selectedFile()).toBe("/games/first.pgn");
});

test("cancelling a replacement preserves the selected file and collection filename", async () => {
  await choose("/games/keep.pgn");
  await act(async () =>
    document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(),
  );
  const name = document.querySelector<HTMLInputElement>("input[required]");
  expect(name?.value).toBe("keep");
  await choose(null);
  expect(selectedFile()).toBe("/games/keep.pgn");
  expect(name?.value).toBe("keep");
});
