import dynamic from "next/dynamic";

const SettingsController = dynamic(
  () => import("../components/SettingsController"),
  {
    ssr: false,
  }
);

export default function Page() {
  return <SettingsController />;
}
