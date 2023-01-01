import dynamic from "next/dynamic";

const SettingsPage = dynamic(
  () => import("../components/settings/SettingsPage"),
  { ssr: false }
);

export default function Page() {
  return <SettingsPage />;
}
