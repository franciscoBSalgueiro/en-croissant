import {
  Anchor,
  Button,
  Code,
  CopyButton,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export default function ErrorComponent({
  error,
}: {
  error: unknown;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Stack p="md">
      <Title>{t("Error.Title")}</Title>
      {error instanceof Error ? (
        <>
          <Text>
            <b>{error.name}:</b> {error.message}
          </Text>
          <Code>{error.stack}</Code>
          {error.cause}
        </>
      ) : (
        <Text>
          <b>{t("Error.Unexpected")}:</b> {JSON.stringify(error)}
        </Text>
      )}
      <Group>
        {error instanceof Error && (
          <CopyButton value={`${error.message}\n${error.stack}`}>
            {({ copied, copy }) => (
              <Button color={copied ? "teal" : undefined} onClick={copy}>
                {copied ? t("Common.Copied") : t("Error.CopyStackTrace")}
              </Button>
            )}
          </CopyButton>
        )}
        <Button
          onClick={() =>
            navigate({ to: "/" }).then(() => window.location.reload())
          }
        >
          {t("Menu.View.Reload")}
        </Button>
      </Group>

      <Text>
        {t("Error.ReportPrefix")}{" "}
        <Anchor
          href="https://github.com/franciscoBSalgueiro/en-croissant/issues/new?assignees=&labels=bug&projects=&template=bug.yml"
          target="_blank"
        >
          {t("Error.Github")}
        </Anchor>{" "}
        {t("Error.Or")}{" "}
        <Anchor href="https://discord.com/invite/tdYzfDbSSW" target="_blank">
          {t("Error.Discord")}
        </Anchor>
      </Text>
    </Stack>
  );
}
