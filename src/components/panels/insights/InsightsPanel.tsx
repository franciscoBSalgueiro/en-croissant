import {
  Alert,
  Badge,
  Divider,
  Group,
  List,
  ScrollArea,
  Skeleton,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useAtomValue } from "jotai";
import { memo, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr/immutable";
import { commands } from "@/bindings";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  activeTabAtom,
  engineMovesFamily,
  enginesAtom,
  firstEngineWithLinesFamily,
} from "@/state/atoms";
import { getVariationLine } from "@/utils/chess";
import { swapMove } from "@/utils/chessops";
import { insightsBulletKeys, motifTranslationKey } from "@/utils/insightsText";
import { formatScore } from "@/utils/score";
import { unwrap } from "@/utils/unwrap";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

function SectionTitle({ label }: { label: string }) {
  return (
    <Text fz="xs" fw={700} tt="uppercase" c="dimmed">
      {label}
    </Text>
  );
}

function formatMaterialDiff(diff: number): string {
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function Checkmark({ ok }: { ok: boolean }) {
  return (
    <Text fz="sm" c={ok ? "teal" : "dimmed"} ta="center">
      {ok ? "✓" : "✗"}
    </Text>
  );
}

function FilesValue({ files }: { files: string[] }) {
  return (
    <Text fz="sm" ta="center">
      {files.length > 0 ? files.join(", ") : "—"}
    </Text>
  );
}

function InsightsPanel() {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.currentNode().fen);
  const rootFen = useStore(store, (s) => s.root.fen);
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position)),
  );

  const [debouncedFen] = useDebouncedValue(fen, 100);

  const {
    data: insights,
    error,
    isLoading,
  } = useSWR(
    debouncedFen ? ["position-insights", debouncedFen] : null,
    async ([, f]: [string, string]) => unwrap(await commands.positionInsights(f)),
  );

  const bullets = useMemo(() => (insights ? insightsBulletKeys(insights) : []), [insights]);

  // Engine note: first engine with lines for the current position.
  const engines = useAtomValue(enginesAtom);
  const hasLoadedEngines = (engines ?? []).some((e) => e.loaded);
  const activeTab = useAtomValue(activeTabAtom);
  const engineId = useAtomValue(firstEngineWithLinesFamily({ fen: rootFen, gameMoves: moves }));
  const engineLines = useAtomValue(
    engineMovesFamily({ engine: engineId ?? "", tab: activeTab ?? "" }),
  );
  const engineNote = useMemo(() => {
    if (!hasLoadedEngines) return null;
    const lines =
      engineLines.get(`${swapMove(fen)}:`) ?? engineLines.get(`${rootFen}:${moves.join(",")}`);
    if (!lines || lines.length === 0 || lines[0].sanMoves.length === 0) return null;
    return {
      san: lines[0].sanMoves[0],
      score: formatScore(lines[0].score.value, 1),
    };
  }, [engineLines, fen, rootFen, moves, hasLoadedEngines]);

  return (
    <Stack h="100%" gap={0}>
      <ScrollArea flex={1} offsetScrollbars px="sm" py="xs">
        {error ? (
          <Alert color="red">{error.toString()}</Alert>
        ) : isLoading || !insights ? (
          <Stack gap="sm" pt="xs">
            <Skeleton height={14} radius="xl" />
            <Skeleton height={14} radius="xl" />
            <Skeleton height={14} radius="xl" mr="30%" />
          </Stack>
        ) : (
          <Stack gap="md" pb="sm">
            <Stack gap={4}>
              <SectionTitle label={t("Insights.Summary")} />
              <List listStyleType="disc" fz="sm" spacing={2} withPadding>
                {bullets.map((bullet, i) => (
                  <List.Item key={i}>{t(bullet.key, bullet.params)}</List.Item>
                ))}
              </List>
              {engineNote && (
                <Text fz="sm" c="dimmed">
                  {t("Insights.EnginePrefers", {
                    move: engineNote.san,
                    eval: engineNote.score,
                  })}
                </Text>
              )}
            </Stack>

            <Divider />

            <Stack gap={4}>
              <SectionTitle label={t("Insights.MaterialDevelopment")} />
              <Group justify="space-between" wrap="nowrap">
                <Text fz="sm">{t("Insights.Material")}</Text>
                <Text fz="sm" fw={600}>
                  {formatMaterialDiff(insights.material_diff)}
                </Text>
              </Group>
              <Table fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th />
                    <Table.Th ta="center">{t("Common.WHITE")}</Table.Th>
                    <Table.Th ta="center">{t("Common.BLACK")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>{t("Insights.Castled")}</Table.Td>
                    <Table.Td>
                      <Checkmark ok={insights.white_castled} />
                    </Table.Td>
                    <Table.Td>
                      <Checkmark ok={insights.black_castled} />
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>{t("Insights.DevelopedMinors")}</Table.Td>
                    <Table.Td>
                      <Text fz="sm" ta="center">
                        {insights.white_minor_developed}/4
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm" ta="center">
                        {insights.black_minor_developed}/4
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Stack>

            <Divider />

            <Stack gap={4}>
              <SectionTitle label={t("Insights.HangingPieces")} />
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text fz="sm">{t("Common.WHITE")}</Text>
                {insights.hanging_white.length > 0 ? (
                  <Group gap={4} wrap="wrap" justify="flex-end">
                    {insights.hanging_white.map((square) => (
                      <Badge key={square} color="red" variant="light" fz="xs">
                        {square}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text fz="sm" c="dimmed">
                    {t("Insights.None")}
                  </Text>
                )}
              </Group>
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text fz="sm">{t("Common.BLACK")}</Text>
                {insights.hanging_black.length > 0 ? (
                  <Group gap={4} wrap="wrap" justify="flex-end">
                    {insights.hanging_black.map((square) => (
                      <Badge key={square} color="red" variant="light" fz="xs">
                        {square}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text fz="sm" c="dimmed">
                    {t("Insights.None")}
                  </Text>
                )}
              </Group>
            </Stack>

            <Divider />

            <Stack gap={4}>
              <SectionTitle label={t("Insights.Structure")} />
              {insights.structure.motifs.length > 0 ? (
                <Group gap={4}>
                  {insights.structure.motifs.map((motif) => (
                    <Badge key={motif} variant="outline" color="indigo" fz="xs" title={motif}>
                      {t(motifTranslationKey(motif), motif)}
                    </Badge>
                  ))}
                </Group>
              ) : (
                <Text fz="sm" c="dimmed">
                  {t("Insights.NoMotifs")}
                </Text>
              )}
              <Table fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th />
                    <Table.Th ta="center">{t("Common.WHITE")}</Table.Th>
                    <Table.Th ta="center">{t("Common.BLACK")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(
                    [
                      [
                        t("Insights.Doubled"),
                        insights.structure.features.white_doubled,
                        insights.structure.features.black_doubled,
                      ],
                      [
                        t("Insights.Isolated"),
                        insights.structure.features.white_isolated,
                        insights.structure.features.black_isolated,
                      ],
                      [
                        t("Insights.Passed"),
                        insights.structure.features.white_passed,
                        insights.structure.features.black_passed,
                      ],
                      [
                        t("Insights.Islands"),
                        insights.structure.features.white_islands,
                        insights.structure.features.black_islands,
                      ],
                    ] as [string, number, number][]
                  ).map(([label, white, black]) => (
                    <Table.Tr key={label}>
                      <Table.Td>{label}</Table.Td>
                      <Table.Td>
                        <Text fz="sm" ta="center">
                          {white}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" ta="center">
                          {black}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td>{t("Insights.OpenFiles")}</Table.Td>
                    <Table.Td colSpan={2}>
                      <FilesValue files={insights.structure.features.open_files} />
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>{t("Insights.SemiOpenWhite")}</Table.Td>
                    <Table.Td colSpan={2}>
                      <FilesValue files={insights.structure.features.semi_open_white} />
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>{t("Insights.SemiOpenBlack")}</Table.Td>
                    <Table.Td colSpan={2}>
                      <FilesValue files={insights.structure.features.semi_open_black} />
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Stack>
          </Stack>
        )}
      </ScrollArea>
    </Stack>
  );
}

export default memo(InsightsPanel);
