import dynamic from "next/dynamic";

const DatabaseView = dynamic(() => import("../../components/databases/DatabaseView"), {
  ssr: false,
});

export default function Page() {
  return <DatabaseView />;
}
