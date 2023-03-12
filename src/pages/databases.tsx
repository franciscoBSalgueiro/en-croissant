import dynamic from "next/dynamic";

const DatabasesPage = dynamic(
  () => import("../components/databases/DatabasesPage"),
  {
    ssr: false,
  }
);

export default function Page() {
  return <DatabasesPage />;
}
