import { ActionIcon, Group, Progress, Stack, Table, Text } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { DataTable } from "mantine-datatable";
import { memo, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { OpeningMoveReport } from "@/bindings";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { moveNotationTypeAtom } from "@/state/atoms";
import { addPieceSymbol } from "@/utils/annotation";
import { formatNumber } from "@/utils/format";
import classes from "./OpeningsTable.module.css";

type WdlStat = { total: number; white: number; draw: number; black: number };

function ResultBar({
  white,
  draw,
  black,
  size = "xl",
}: {
  white: number;
  draw: number;
  black: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  const total = white + draw + black;
  const whitePercent = total > 0 ? (white / total) * 100 : 0;
  const drawPercent = total > 0 ? (draw / total) * 100 : 0;
  const blackPercent = total > 0 ? (black / total) * 100 : 0;
  const showLabels = size === "xl";
  return (
    <Progress.Root size={size} className={classes.result}>
      <Progress.Section value={whitePercent} className={classes.whiteResultsSection}>
        <Progress.Label c="black">
          {showLabels && whitePercent > 10 ? `${whitePercent.toFixed(1)}%` : ""}
        </Progress.Label>
      </Progress.Section>
      <Progress.Section value={drawPercent} color="gray">
        <Progress.Label>
          {showLabels && drawPercent > 10 ? `${drawPercent.toFixed(1)}%` : ""}
        </Progress.Label>
      </Progress.Section>
      <Progress.Section value={blackPercent} color="black">
        <Progress.Label>
          {showLabels && blackPercent > 10 ? `${blackPercent.toFixed(1)}%` : ""}
        </Progress.Label>
      </Progress.Section>
    </Progress.Root>
  );
}

function DetailTable<T extends WdlStat>({
  title,
  labelHeader,
  records,
  getLabel,
}: {
  title: string;
  labelHeader: string;
  records: T[];
  getLabel: (record: T) => string;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap={4} flex={1} miw={230} maw={440}>
      <Text fz="sm" fw={600}>
        {title}
      </Text>
      {records.length === 0 ? (
        <Text fz="sm" c="dimmed">
          {t("Board.Database.ReportEmpty")}
        </Text>
      ) : (
        <Table highlightOnHover fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{labelHeader}</Table.Th>
              <Table.Th w={70}>{t("Board.Database.Total")}</Table.Th>
              <Table.Th w={0} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {records.map((stat, i) => (
              <Table.Tr key={i}>
                <Table.Td>{getLabel(stat)}</Table.Td>
                <Table.Td>{formatNumber(stat.total)}</Table.Td>
                <Table.Td>
                  <ResultBar white={stat.white} draw={stat.draw} black={stat.black} size="sm" />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

function ReportDetail({ record }: { record: OpeningMoveReport }) {
  const { t } = useTranslation();
  return (
    <Group align="flex-start" gap="xl" p="sm" wrap="wrap">
      <DetailTable
        title={t("Board.Database.EloBuckets")}
        labelHeader={t("Board.Database.Elo")}
        records={record.elo_buckets}
        getLabel={(stat) => stat.bucket}
      />
      <DetailTable
        title={t("Board.Database.Yearly")}
        labelHeader={t("Board.Database.Year")}
        records={record.yearly}
        getLabel={(stat) => stat.year}
      />
    </Group>
  );
}

function OpeningReportTable({
  report,
  loading,
}: {
  report: OpeningMoveReport[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext)!;
  const makeMove = useStore(store, (s) => s.makeMove);
  const [moveNotationType] = useAtom(moveNotationTypeAtom);

  const records = [...report].sort((a, b) => b.total - a.total);
  const grandTotal = records.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <DataTable
      withTableBorder
      highlightOnHover
      records={records}
      fetching={loading || report === null}
      columns={[
        {
          accessor: "move_",
          title: t("Board.Database.Move"),
          width: 120,
          render: ({ move_ }) => {
            if (move_ === "*")
              return (
                <Text fz="sm" fs="italic">
                  Game end
                </Text>
              );
            return (
              <Group gap="xs" wrap="nowrap">
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  aria-label={`${t("Board.Database.Play")} ${move_}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    makeMove({ payload: move_ });
                  }}
                >
                  <IconPlayerPlay size="0.8rem" />
                </ActionIcon>
                <Text fz="sm">
                  {moveNotationType === "symbols" ? addPieceSymbol(move_) : move_}
                </Text>
              </Group>
            );
          },
        },
        {
          accessor: "total",
          width: 180,
          render: ({ total }) => {
            const percentage = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
            return (
              <Group>
                <Text fz="sm">{percentage.toFixed(0)}%</Text>
                <Text fz="sm" flex={1} ta="right">
                  {formatNumber(total)}
                </Text>
              </Group>
            );
          },
        },
        {
          accessor: "results",
          render: ({ white, draw, black }) => <ResultBar white={white} draw={draw} black={black} />,
        },
        {
          accessor: "avg_elo",
          title: t("Board.Database.AverageElo"),
          width: 100,
          textAlign: "right",
          render: ({ avg_elo }) => (
            <Text fz="sm">{avg_elo === null ? "—" : formatNumber(Math.round(avg_elo))}</Text>
          ),
        },
      ]}
      idAccessor="move_"
      emptyState={
        <Text fz="sm" c="dimmed">
          {t("Board.Database.ReportEmpty")}
        </Text>
      }
      rowExpansion={{
        trigger: "click",
        content: ({ record }) => <ReportDetail record={record} />,
      }}
    />
  );
}

export default memo(OpeningReportTable);
