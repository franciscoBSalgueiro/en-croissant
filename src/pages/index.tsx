import dynamic from "next/dynamic";

const BoardTabs = dynamic(() => import("../components/tabs/BoardsPage"), {
  ssr: false,
});

export default function Page() {
  return (
    <>
      <BoardTabs />
    </>
  );
}
