import { Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function NoDatabaseWarning() {
  const { t } = useTranslation();

  return (
    <>
      <Text>{t("Board.Database.NoReference1")}</Text>
      <Text>
        {t("Board.Database.NoReference2")}{" "}
        <Link to="/databases">{t("Board.Database.SelectReference")}</Link>{" "}
        {t("Board.Database.NoReference3")}
      </Text>
    </>
  );
}

export default NoDatabaseWarning;
