import dynamic from "next/dynamic";

const DatabasesTable = dynamic(() => import("../components/DatabasesTable"), {
  ssr: false,
});

export default function Page() {
  return <DatabasesTable />;
}
