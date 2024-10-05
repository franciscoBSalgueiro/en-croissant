import {
  autoPromoteAtom,
  autoSaveAtom,
  enableBoardScrollAtom,
  eraseDrawablesOnClickAtom,
  forcedEnPassantAtom,
  minimumGamesAtom,
  moveInputAtom,
  moveMethodAtom,
  moveNotationTypeAtom,
  nativeBarAtom,
  percentageCoverageAtom,
  previewBoardOnHoverAtom,
  showArrowsAtom,
  showConsecutiveArrowsAtom,
  showCoordinatesAtom,
  showDestsAtom,
  snapArrowsAtom,
  spellCheckAtom,
  storedDocumentDirAtom,
} from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import {
  ActionIcon,
  Card,
  Group,
  ScrollArea,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconBook,
  IconBrush,
  IconChess,
  IconFlag,
  IconFolder,
  IconKeyboard,
  IconMouse,
  IconReload,
  IconVolume,
} from "@tabler/icons-react";
import { useLoaderData } from "@tanstack/react-router";
import { open } from "@tauri-apps/plugin-dialog";
import { useAtom } from "jotai";
import { RESET } from "jotai/utils";
import { useTranslation } from "react-i18next";
import FileInput from "../common/FileInput";
import BoardSelect from "./BoardSelect";
import ColorControl from "./ColorControl";
import FontSizeSlider from "./FontSizeSlider";
import KeybindInput from "./KeybindInput";
import PiecesSelect from "./PiecesSelect";
import SettingsNumberInput from "./SettingsNumberInput";
import * as classes from "./SettingsPage.css";
import SettingsSwitch from "./SettingsSwitch";
import SoundSelect from "./SoundSelect";
import ThemeButton from "./ThemeButton";
import VolumeSlider from "./VolumeSlider";

export default function Page() {
  const { t, i18n } = useTranslation();

  // const version = useLoaderData() as string;
  const [keyMap, setKeyMap] = useAtom(keyMapAtom);
  const [isNative, setIsNative] = useAtom(nativeBarAtom);
  const {
    dirs: { documentDir },
    version,
  } = useLoaderData({ from: "/settings" });
  let [filesDirectory, setFilesDirectory] = useAtom(storedDocumentDirAtom);
  filesDirectory = filesDirectory || documentDir;

  const [moveMethod, setMoveMethod] = useAtom(moveMethodAtom);
  const [moveNotationType, setMoveNotationType] = useAtom(moveNotationTypeAtom);

  return (
    <Tabs defaultValue="board" orientation="vertical" h="100%">
      <Tabs.List>
        <Tabs.Tab value="board" leftSection={<IconChess size="1rem" />}>
          {t("Settings.Board")}
        </Tabs.Tab>
        <Tabs.Tab value="inputs" leftSection={<IconMouse size="1rem" />}>
          {t("Settings.Inputs")}
        </Tabs.Tab>
        <Tabs.Tab value="report" leftSection={<IconBook size="1rem" />}>
          {t("Settings.OpeningReport")}
        </Tabs.Tab>
        <Tabs.Tab value="anarchy" leftSection={<IconFlag size="1rem" />}>
          {t("Settings.Anarchy")}
        </Tabs.Tab>
        <Tabs.Tab value="appearance" leftSection={<IconBrush size="1rem" />}>
          {t("Settings.Appearance")}
        </Tabs.Tab>
        <Tabs.Tab value="sound" leftSection={<IconVolume size="1rem" />}>
          {t("Settings.Sound")}
        </Tabs.Tab>
        <Tabs.Tab value="keybinds" leftSection={<IconKeyboard size="1rem" />}>
          {t("Settings.Keybinds")}
        </Tabs.Tab>
        <Tabs.Tab value="directories" leftSection={<IconFolder size="1rem" />}>
          {t("Settings.Directories")}
        </Tabs.Tab>
      </Tabs.List>
      <Stack flex={1} px="md" pt="md">
        <ScrollArea>
          <Card withBorder p="lg" className={classes.card} w="100%">
            <Tabs.Panel value="board">
              <Text size="lg" fw={500} className={classes.title}>
                {t("Settings.Board")}
              </Text>
              <Text size="xs" c="dimmed" mt={3} mb="lg">
                {t("Settings.Board.Desc")}
              </Text>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.PieceDest")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.PieceDest.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={showDestsAtom} />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Arrows")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Arrows.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={showArrowsAtom} />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>Move notation</Text>
                  <Text size="xs" c="dimmed">
                    Choose how to display pieces in notation
                  </Text>
                </div>
                <Select
                  data={[
                    { label: "Letters (K Q R B N)", value: "letters" },
                    { label: "Symbols (♔♕♖♗♘)", value: "symbols" },
                  ]}
                  allowDeselect={false}
                  value={moveNotationType}
                  onChange={(val) =>
                    setMoveNotationType(val as "letters" | "symbols")
                  }
                />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>Ways to Move Pieces</Text>
                  <Text size="xs" c="dimmed">
                    Move pieces by dragging, clicking, or both
                  </Text>
                </div>
                <Select
                  data={[
                    { label: "Drag", value: "drag" },
                    { label: "Click", value: "select" },
                    { label: "Both", value: "both" },
                  ]}
                  allowDeselect={false}
                  value={moveMethod}
                  onChange={(val) =>
                    setMoveMethod(val as "drag" | "select" | "both")
                  }
                />
              </Group>

              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.SnapArrows")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.SnapArrows.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={snapArrowsAtom} />
              </Group>

              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.ConsecutiveArrows")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.ConsecutiveArrows.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={showConsecutiveArrowsAtom} />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.EraseDrawablesOnClick")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.EraseDrawablesOnClick.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={eraseDrawablesOnClickAtom} />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.AutoPromition")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.AutoPromition.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={autoPromoteAtom} />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Coordinates")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Coordinates.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={showCoordinatesAtom} />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.AutoSave")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.AutoSave.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={autoSaveAtom} />
              </Group>

              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.PreviewBoard")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.PreviewBoard.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={previewBoardOnHoverAtom} />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.ScrollThroughMoves")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.ScrollThroughMoves.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={enableBoardScrollAtom} />
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="inputs">
              <Text size="lg" fw={500} className={classes.title}>
                {t("Settings.Inputs")}
              </Text>
              <Text size="xs" c="dimmed" mt={3} mb="lg">
                {t("Settings.Inputs.Desc")}
              </Text>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Inputs.TextInput")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Inputs.TextInput.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={moveInputAtom} />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Inputs.SpellCheck")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Inputs.SpellCheck.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={spellCheckAtom} />
              </Group>
            </Tabs.Panel>
            <Tabs.Panel value="report">
              <Text size="lg" fw={500} className={classes.title}>
                {t("Settings.OpeningReport")}
              </Text>
              <Text size="xs" c="dimmed" mt={3} mb="lg">
                {t("Settings.OpeningReport.Desc")}
              </Text>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.OpeningReport.PercentCoverage")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.OpeningReport.PercentCoverage.Desc")}
                  </Text>
                </div>
                <SettingsNumberInput
                  atom={percentageCoverageAtom}
                  min={50}
                  max={100}
                  step={1}
                />
              </Group>

              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.OpeningReport.MinGames")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.OpeningReport.MinGames.Desc")}
                  </Text>
                </div>
                <SettingsNumberInput atom={minimumGamesAtom} min={0} step={1} />
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="anarchy">
              <Text size="lg" fw={500} className={classes.title}>
                {t("Settings.Anarchy")}
              </Text>
              <Text size="xs" c="dimmed" mt={3} mb="lg">
                {t("Settings.Anarchy.Desc")}
              </Text>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Anarchy.ForcedEnCroissant")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Anarchy.ForcedEnCroissant.Desc")}
                  </Text>
                </div>
                <SettingsSwitch atom={forcedEnPassantAtom} />
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="appearance">
              <Text size="lg" fw={500} className={classes.title}>
                {t("Settings.Appearance")}
              </Text>
              <Text size="xs" c="dimmed" mt={3} mb="lg">
                {t("Settings.Appearance.Desc")}
              </Text>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Appearance.Theme")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Appearance.Theme.Desc")}
                  </Text>
                </div>
                <ThemeButton />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Appearance.Language")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Appearance.Language.Desc")}
                  </Text>
                </div>
                <Select
                  allowDeselect={false}
                  data={[
                    {
                      value: "be_BY",
                      label: "Belarusian",
                    },
                    {
                      value: "zh_CN",
                      label: "Chinese",
                    },
                    {
                      value: "en_US",
                      label: "English",
                    },
                    {
                      value: "fr_FR",
                      label: "Français",
                    },
                    {
                      value: "pl_PL",
                      label: "Polish",
                    },
                    {
                      value: "nb_NO",
                      label: "Norsk bokmål",
                    },
                    {
                      value: "pt_PT",
                      label: "Portuguese",
                    },
                    {
                      value: "ru_RU",
                      label: "Russian",
                    },
                    {
                      value: "es_ES",
                      label: "Spanish",
                    },
                    {
                      value: "it_IT",
                      label: "Italian",
                    },
                    {
                      value: "uk_UA",
                      label: "Ukrainian",
                    },
                    {
                      value: "tr_TR",
                      label: "Türkçe",
                    },
                  ]}
                  value={i18n.language}
                  onChange={(val) => {
                    i18n.changeLanguage(val || "en_US");
                    localStorage.setItem("lang", val || "en_US");
                  }}
                />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Appearance.TitleBar")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Appearance.TitleBar.Desc")}
                  </Text>
                </div>
                <Select
                  allowDeselect={false}
                  data={["Native", "Custom"]}
                  value={isNative ? "Native" : "Custom"}
                  onChange={(val) => {
                    setIsNative(val === "Native");
                  }}
                />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Appearance.FontSize")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Appearance.FontSize.Desc")}
                  </Text>
                </div>
                <FontSizeSlider />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Appearance.PieceSet")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Appearance.PieceSet.Desc")}
                  </Text>
                </div>
                <PiecesSelect />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Appearance.BoardImage")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Appearance.BoardImage.Desc")}
                  </Text>
                </div>
                <BoardSelect />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Appearance.AccentColor")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Appearance.AccentColor.Desc")}
                  </Text>
                </div>
                <div style={{ width: 200 }}>
                  <ColorControl />
                </div>
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="sound">
              <Text size="lg" fw={500} className={classes.title}>
                {t("Settings.Sound")}
              </Text>
              <Text size="xs" c="dimmed" mt={3} mb="lg">
                {t("Settings.Sound.Desc")}
              </Text>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Sound.Volume")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Sound.Volume.Desc")}
                  </Text>
                </div>
                <VolumeSlider />
              </Group>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Sound.Collection")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Sound.Collection.Desc")}
                  </Text>
                </div>
                <SoundSelect />
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="keybinds">
              <Group>
                <Text size="lg" fw={500} className={classes.title}>
                  Keybinds
                </Text>
                <Tooltip label="Reset">
                  <ActionIcon onClick={() => setKeyMap(RESET)}>
                    <IconReload size="1rem" />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Text size="xs" c="dimmed" mt={3} mb="lg">
                Customize keyboard shortcuts
              </Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Key</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(keyMap).map(([action, keybind]) => {
                    return (
                      <Table.Tr key={keybind.name}>
                        <Table.Td>{keybind.name}</Table.Td>
                        <Table.Td>
                          <KeybindInput action={action} keybind={keybind} />
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>

            <Tabs.Panel value="directories">
              <Text size="lg" fw={500} className={classes.title}>
                {t("Settings.Directories")}
              </Text>
              <Text size="xs" c="dimmed" mt={3} mb="lg">
                {t("Settings.Directories.Desc")}
              </Text>
              <Group
                justify="space-between"
                wrap="nowrap"
                gap="xl"
                className={classes.item}
              >
                <div>
                  <Text>{t("Settings.Directories.Files")}</Text>
                  <Text size="xs" c="dimmed">
                    {t("Settings.Directories.Files.Desc")}
                  </Text>
                </div>
                <FileInput
                  onClick={async () => {
                    const selected = await open({
                      multiple: false,
                      directory: true,
                    });
                    if (!selected || typeof selected !== "string") return;
                    setFilesDirectory(selected);
                  }}
                  filename={filesDirectory || null}
                />
              </Group>
            </Tabs.Panel>
          </Card>
        </ScrollArea>
        <Text size="xs" c="dimmed" ta="right">
          En Croissant v{version}
        </Text>
      </Stack>
    </Tabs>
  );
}
