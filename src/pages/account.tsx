import dynamic from "next/dynamic";

const UserPage = dynamic(() => import("../components/user/UserPage"), {
  ssr: false,
});

function Page() {
  return <UserPage />;
}

export default Page;
