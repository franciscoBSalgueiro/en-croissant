import {
  type ReportState,
  type ReportStore,
  createReportStore,
} from "@/state/store";
import { createContext, useRef } from "react";

export const ReportStateContext = createContext<ReportStore | null>(null);

export function ReportStateProvider({
  id,
  initial,
  children,
}: {
  id?: string;
  initial?: ReportState;
  children: React.ReactNode;
}) {
  const store = useRef(createReportStore(id, initial)).current;

  return (
    <ReportStateContext.Provider value={store}>
      {children}
    </ReportStateContext.Provider>
  );
}
