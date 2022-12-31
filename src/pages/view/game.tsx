import dynamic from "next/dynamic";

const BoardAnalysis = dynamic(() => import("../../components/BoardAnalysis"), {
  ssr: false,
});

export default function Page() {
  return (
    <>
      <BoardAnalysis loadGame />
    </>
  );
}
