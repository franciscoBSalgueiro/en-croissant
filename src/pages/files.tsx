import dynamic from "next/dynamic";

const FilesPage = dynamic(() => import("../components/files/FilesPage"), {
  ssr: false,
});

export default function Page() {
  return <FilesPage />;
}
