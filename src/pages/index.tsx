import { Card, SimpleGrid, Stack, Title } from "@mantine/core";
import dynamic from "next/dynamic";

const Accounts = dynamic(() => import("../components/home/Accounts"), {
  ssr: false,
});

const Databases = dynamic(() => import("../components/home/Databases"), {
  ssr: false,
});

function Page() {
  return (
    <SimpleGrid cols={2} my="md" spacing="md">
      <Card>
        <Stack>
          <Title>Accounts</Title>
          <Accounts />
        </Stack>
      </Card>
      <Card>
        <Stack>
          <Databases />
        </Stack>
      </Card>
    </SimpleGrid>
  );
}

export default Page;
