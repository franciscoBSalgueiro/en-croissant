import dynamic from "next/dynamic";

const EnginePage = dynamic(() => import("../components/engines/EnginePage"), {
  ssr: false,
});

export default function Page() {
  return (
    <>
      <EnginePage />
    </>
  );
}
