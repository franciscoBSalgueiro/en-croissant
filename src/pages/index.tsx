import { Card, Grid, SimpleGrid, Stack, Title } from "@mantine/core";
import dynamic from "next/dynamic";
import { AccountCard } from "../components/home/AccountCard";

const RecentGames = dynamic(() => import("../components/home/RecentGames"), {
  ssr: false,
});

const AccountsList = dynamic(() => import("../components/home/AccountsList"), {
  ssr: false,
});

function Page() {
  return (
    <SimpleGrid
      cols={2}
      h="95vh"
      spacing="md"
      breakpoints={[{ maxWidth: "sm", cols: 1 }]}
    >
      <Card>
        <Stack>
          <Title>Overview</Title>
          <AccountCard
            title={"Lichess.org"}
            description={"Last updated 2 days ago"}
            completed={100}
            total={210}
            stats={[
              { value: 100, label: "Wins" },
              { value: 13, label: "Draws" },
              { value: 70, label: "Losses" },
            ]}
          />
          <AccountCard
            title={"Chess.com"}
            description={"Last updated 2 days ago"}
            completed={100}
            total={210}
            stats={[
              { value: 100, label: "Wins" },
              { value: 13, label: "Draws" },
              { value: 70, label: "Losses" },
            ]}
          />
          <AccountsList />
        </Stack>
      </Card>
      <Grid gutter="md">
        <Grid.Col>
          <Card h="100%">
            <Title>Recent Games</Title>
            <RecentGames />
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card h="100%">
            <Title>Engines</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card h="100%">
            <Title>Databases</Title>
          </Card>
        </Grid.Col>
      </Grid>
    </SimpleGrid>
  );
}

export default Page;
