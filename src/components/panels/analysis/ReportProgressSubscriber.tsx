import { events } from "@/bindings";
import { useStore } from "zustand";
import React, { memo, useEffect, useContext } from "react";
import { ReportStateContext } from "@/components/common/ReportStateContext";

type Props = {
  id: string;
};

function ReportProgressSubscriber({ id }: Props) {
  const reportStore = useContext(ReportStateContext)!;
  const setCompleted = useStore(reportStore, (s) => s.setCompleted);
  const setInProgress = useStore(reportStore, (s) => s.setInProgress);
  const setProgress = useStore(reportStore, (s) => s.setProgress);

  useEffect(() => {
    const unlisten = events.reportProgress.listen(async ({ payload }) => {
      if (payload.id !== id) return;
      if (payload.finished) {
        setInProgress(false);
        setCompleted(true);
        setProgress(0);
      } else {
        setProgress(payload.progress);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [id]);

  return <></>;
}

export default memo(ReportProgressSubscriber);
