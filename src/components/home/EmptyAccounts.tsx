import { Button, Center, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconPlus, IconUserPlus } from "@tabler/icons-react";

export function EmptyAccounts({ onAddAccount }: { onAddAccount: () => void }) {
  return (
    <Center h="100%">
      <Stack align="center" gap="md">
        <ThemeIcon size={80} radius="100%" variant="light" color="blue">
          <IconUserPlus size={40} />
        </ThemeIcon>
        <Title order={3}>No accounts connected</Title>
        <Text c="dimmed" ta="center" maw={400}>
          Connect your Lichess or Chess.com account to analyze your games and
          track your progress.
        </Text>
        <Button onClick={onAddAccount} size="md" mt="sm">
          Add Account
        </Button>
      </Stack>
    </Center>
  );
}
