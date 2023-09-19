import Accounts from "./Accounts";
import Databases from "./Databases";
import { Card, SimpleGrid, Stack, Title } from "@mantine/core";

function HomePage() {
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

export default HomePage;
