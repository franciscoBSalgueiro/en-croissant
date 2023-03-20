import { Card, Grid, SimpleGrid, Stack, Title } from "@mantine/core";
import dynamic from "next/dynamic";

const Accounts = dynamic(() => import("../components/home/Accounts"), {
  ssr: false,
});

const Engines = dynamic(() => import("../components/home/Engines"), {
  ssr: false,
});

const Databases = dynamic(() => import("../components/home/Databases"), {
  ssr: false,
});

function Page() {
  return (
    <SimpleGrid
      cols={2}
      my="md"
      spacing="md"
      breakpoints={[{ maxWidth: "md", cols: 1 }]}
    >
      <Card>
        <Stack>
          <Title>Accounts</Title>
          <Accounts />
        </Stack>
      </Card>
      <Grid gutter="md">
        <Grid.Col span={6}>
          <Card h="100%">
            <Stack>
              <Title>Engines</Title>
              <Engines />
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card h="100%">
            <Stack>
              <Title>Databases</Title>
              <Databases />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </SimpleGrid>
  );
}

export default Page;
