import dynamic from "next/dynamic";

const BoardTabs = dynamic(() => import("../components/BoardTabs"), {
  ssr: false,
});

export default function Page() {
  return (
    <>
      <BoardTabs />
    </>
  );
}
