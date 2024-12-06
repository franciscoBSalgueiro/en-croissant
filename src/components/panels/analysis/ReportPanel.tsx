import { events } from "@/bindings";
import EvalChart from "@/components/common/EvalChart";
import ProgressButton from "@/components/common/ProgressButton";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import { activeTabAtom } from "@/state/atoms";
import { ANNOTATION_INFO, isBasicAnnotation } from "@/utils/annotation";
import { getGameStats, getMainLine } from "@/utils/chess";
import { Grid, Group, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconZoomCheck } from "@tabler/icons-react";
import cx from "clsx";
import equal from "fast-deep-equal";
import { useAtomValue } from "jotai";
import React, { Suspense, useState } from "react";
import { memo, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { label } from "./AnalysisPanel.css";
import ReportModal from "./ReportModal";

function ReportPanel() {
  const { t } = useTranslation();

  const activeTab = useAtomValue(activeTabAtom);

  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const headers = useStore(store, (s) => s.headers);

  const [reportingMode, toggleReportingMode] = useToggle();
  const [inProgress, setInProgress] = useState(false);

  const stats = useMemo(() => getGameStats(root), [root]);

  return (
    <ScrollArea offsetScrollbars>
      <Suspense>
        <ReportModal
          tab={activeTab!}
          initialFen={root.fen}
          moves={getMainLine(root, headers.variant === "Chess960")}
          is960={headers.variant === "Chess960"}
          reportingMode={reportingMode}
          toggleReportingMode={toggleReportingMode}
          setInProgress={setInProgress}
        />
      </Suspense>
      <Stack mb="lg" gap="0.4rem" mr="xs">
        <Group grow style={{ textAlign: "center" }}>
          {stats.whiteAccuracy && stats.blackAccuracy && (
            <>
              <AccuracyCard
                color={t("Common.WHITE")}
                accuracy={stats.whiteAccuracy}
                cpl={stats.whiteCPL}
              />
              <AccuracyCard
                color={t("Common.BLACK")}
                accuracy={stats.blackAccuracy}
                cpl={stats.blackCPL}
              />
            </>
          )}
          <div>
            <ProgressButton
              id={`report_${activeTab}`}
              redoable
              disabled={root.children.length === 0}
              leftIcon={<IconZoomCheck size="0.875rem" />}
              onClick={() => toggleReportingMode()}
              initInstalled={false}
              progressEvent={events.reportProgress}
              labels={{
                action: t("Board.Analysis.GenerateReport"),
                completed: t("Board.Analysis.ReportGenerated"),
                inProgress: t("Board.Analysis.GeneratingReport"),
              }}
              inProgress={inProgress}
              setInProgress={setInProgress}
            />
          </div>
        </Group>
        <Paper withBorder p="md">
          <EvalChart
            isAnalysing={inProgress}
            startAnalysis={toggleReportingMode}
          />
        </Paper>
        <GameStats {...stats} />
      </Stack>
    </ScrollArea>
  );
}

type Stats = ReturnType<typeof getGameStats>;

const GameStats = memo(
  function GameStats({ whiteAnnotations, blackAnnotations }: Stats) {
    const { t } = useTranslation();

    const store = useContext(TreeStateContext)!;
    const goToAnnotation = useStore(store, (s) => s.goToAnnotation);

    return (
      <Paper withBorder>
        <Grid columns={11} justify="space-between" p="md">
          {Object.keys(ANNOTATION_INFO)
            .filter((a) => isBasicAnnotation(a))
            .map((annotation) => {
              const s = annotation as "??" | "?" | "?!" | "!!" | "!" | "!?";
              const { name, color, translationKey } = ANNOTATION_INFO[s];
              const w = whiteAnnotations[s];
              const b = blackAnnotations[s];
              return (
                <React.Fragment key={annotation}>
                  <Grid.Col
                    className={cx(w > 0 && label)}
                    span={4}
                    style={{ textAlign: "center" }}
                    c={w > 0 ? color : undefined}
                    onClick={() => {
                      if (w > 0) {
                        goToAnnotation(s, "white");
                      }
                    }}
                  >
                    {w}
                  </Grid.Col>
                  <Grid.Col span={1} c={w + b > 0 ? color : undefined}>
                    {annotation}
                  </Grid.Col>
                  <Grid.Col span={4} c={w + b > 0 ? color : undefined}>
                    {translationKey ? t(`Annotate.${translationKey}`) : name}
                  </Grid.Col>
                  <Grid.Col
                    className={cx(b > 0 && label)}
                    span={2}
                    c={b > 0 ? color : undefined}
                    onClick={() => {
                      if (b > 0) {
                        goToAnnotation(s, "black");
                      }
                    }}
                  >
                    {b}
                  </Grid.Col>
                </React.Fragment>
              );
            })}
        </Grid>
      </Paper>
    );
  },
  (prev, next) => {
    return (
      equal(prev.whiteAnnotations, next.whiteAnnotations) &&
      equal(prev.blackAnnotations, next.blackAnnotations)
    );
  },
);

function AccuracyCard({
  color,
  cpl,
  accuracy,
}: {
  color: string;
  cpl: number;
  accuracy: number;
}) {
  const { t } = useTranslation();

  return (
    <Paper withBorder p="xs">
      <Group justify="space-between">
        <Stack gap={0} align="start">
          <Text c="dimmed">{color}</Text>
          <Text fz="sm">{cpl.toFixed(1)} ACPL</Text>
        </Stack>
        <Stack gap={0} align="center">
          <Text fz="xl" lh="normal">
            {accuracy.toFixed(1)}%
          </Text>
          <Text fz="sm" c="dimmed" lh="normal">
            {t("Board.Analysis.Accuracy")}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}
export default ReportPanel;
