import dynamic from "next/dynamic";

const EngineTable = dynamic(() => import("../components/EngineTable"), {
  ssr: false,
});

export default function Page() {
  return (
    <>
      <EngineTable />
    </>
  );
}
