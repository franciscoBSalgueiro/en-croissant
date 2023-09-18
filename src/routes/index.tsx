import Accounts from "@/components/home/Accounts";
import Databases from "@/components/home/Databases";
import { Card, SimpleGrid, Stack, Title } from "@mantine/core";

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
