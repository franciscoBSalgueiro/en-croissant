import { SegmentedControl, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { PlayerSearchInput } from "@/components/databases/PlayerSearchInput";
import { currentLocalOptionsAtom } from "@/state/atoms";

function LocalOptionsPanel() {
  const { t } = useTranslation();
  const [options, setOptions] = useAtom(currentLocalOptionsAtom);

  return (
    <Stack>
      <SimpleGrid cols={2}>
        <Stack gap={4}>
          <Text fw="bold" fz="sm">
            {t("Board.Database.Local.Player")}
          </Text>
          {options.path && (
            <PlayerSearchInput
              label={t("Common.Search")}
              value={options.player ?? undefined}
              file={options.path}
              setValue={(v) => setOptions((q) => ({ ...q, player: v || null }))}
            />
          )}
        </Stack>
        <Stack gap={4}>
          <Text fw="bold" fz="sm">
            {t("Board.Database.Local.Color")}
          </Text>
          <SegmentedControl
            data={[
              { value: "white", label: t("Fen.White") },
              { value: "black", label: t("Fen.Black") },
            ]}
            value={options.color}
            onChange={(v) => setOptions({ ...options, color: v as "white" | "black" })}
          />
        </Stack>

        <Stack gap={4}>
          <Text fw="bold" fz="sm">
            {t("Common.From")}
          </Text>
          <DateInput
            placeholder={t("Common.StartDate")}
            valueFormat="YYYY-MM-DD"
            clearable
            value={
              options.start_date ? dayjs(options.start_date, "YYYY.MM.DD").toDate() : undefined
            }
            onChange={(value) =>
              setOptions({
                ...options,
                start_date: value ? dayjs(value).format("YYYY.MM.DD") : undefined,
              })
            }
          />
        </Stack>
        <Stack gap={4}>
          <Text fw="bold" fz="sm">
            {t("Common.To")}
          </Text>
          <DateInput
            placeholder={t("Common.EndDate")}
            valueFormat="YYYY-MM-DD"
            clearable
            value={options.end_date ? dayjs(options.end_date, "YYYY.MM.DD").toDate() : null}
            onChange={(value) =>
              setOptions({
                ...options,
                end_date: value ? dayjs(value).format("YYYY.MM.DD") : undefined,
              })
            }
          />
        </Stack>

        <Stack gap={4}>
          <Text fw="bold" fz="sm">
            {t("Board.Database.Local.Result")}
          </Text>
          <Select
            data={[
              { value: "any", label: t("Board.Database.Local.Result.Any") },
              {
                value: "whitewon",
                label: t("Board.Database.Local.Result.WhiteWon"),
              },
              { value: "draw", label: t("Board.Analysis.Tablebase.Draw") },
              {
                value: "blackwon",
                label: t("Board.Database.Local.Result.BlackWon"),
              },
            ]}
            value={options.result}
            onChange={(v) =>
              setOptions({
                ...options,
                result: v as "any" | "whitewon" | "draw" | "blackwon",
              })
            }
          />
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}

export default LocalOptionsPanel;
