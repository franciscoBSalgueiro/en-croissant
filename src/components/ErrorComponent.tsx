import { Anchor, Button, Code, CopyButton, Group, Stack, Text, Title } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";

function formatDetail(detail: unknown): string {
  if (detail === null || detail === undefined) {
    return "";
  }
  if (typeof detail === "string") {
    return detail;
  }
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export default function ErrorComponent({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cause = error instanceof Error ? formatDetail(error.cause) : null;

  return (
    <Stack p="md">
      <Title>{t("Error.Title")}</Title>
      {error instanceof Error ? (
        <>
          <Text>
            <b>{error.name}:</b> {error.message}
          </Text>
          <Code>{error.stack}</Code>
          {cause && <Code>{cause}</Code>}
        </>
      ) : (
        <Text>
          <b>{t("Error.Unexpected")}:</b> {formatDetail(error)}
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
        <Button onClick={() => navigate({ to: "/" }).then(() => window.location.reload())}>
          {t("Menu.View.Reload")}
        </Button>
      </Group>

      <Text>
        <Trans
          i18nKey="Error.ReportIssue"
          components={{
            github: (
              <Anchor
                href="https://github.com/franciscoBSalgueiro/en-croissant/issues/new?assignees=&labels=bug&projects=&template=bug.yml"
                target="_blank"
              />
            ),
            discord: <Anchor href="https://discord.com/invite/tdYzfDbSSW" target="_blank" />,
          }}
        />
      </Text>
    </Stack>
  );
}
