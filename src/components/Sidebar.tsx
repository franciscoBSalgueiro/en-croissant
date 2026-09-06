"use no memo";
import { AppShellSection, Stack, Tooltip, UnstyledButton } from "@mantine/core";
import {
  type Icon,
  IconChess,
  IconCpu,
  IconDatabase,
  IconFiles,
  IconSettings,
  IconUser,
  IconYoga,
} from "@tabler/icons-react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import cx from "clsx";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { zenModeAtom } from "@/state/atoms";
import classes from "./Sidebar.module.css";

interface NavbarLinkProps {
  icon: Icon;
  label: string;
  url: string;
  active?: boolean;
}

function NavbarLink({ url, icon: Icon, label }: NavbarLinkProps) {
  const match = useMatchRoute();
  return (
    <Tooltip label={label} position="right">
      <Link
        to={url}
        className={cx(classes.link, {
          [classes.active]: match({ to: url, fuzzy: true }) !== false,
        })}
      >
        <Icon size="1.5rem" stroke={1.5} />
      </Link>
    </Tooltip>
  );
}

const linksdata = [
  { icon: IconChess, label: "Board", url: "/" },
  { icon: IconUser, label: "User", url: "/accounts" },
  { icon: IconFiles, label: "Files", url: "/files" },
  {
    icon: IconDatabase,
    label: "Databases",
    url: "/databases",
  },
  { icon: IconCpu, label: "Engines", url: "/engines" },
];

export function SideBar() {
  const { t } = useTranslation();
  const [zenMode, setZenMode] = useAtom(zenModeAtom);

  const links = linksdata.map((link) => (
    <NavbarLink {...link} label={t(`SideBar.${link.label}`)} key={link.label} />
  ));

  return (
    <>
      <AppShellSection grow>
        <Stack justify="center" gap={0}>
          {links}
        </Stack>
      </AppShellSection>
      <AppShellSection>
        <Stack justify="center" gap={0}>
          <Tooltip label="Zen Mode (Shift+Z, Esc to exit)" position="right">
            <UnstyledButton
              className={cx(classes.link, { [classes.active]: zenMode })}
              onClick={() => setZenMode((v) => !v)}
            >
              <IconYoga size="1.5rem" stroke={1.5} />
            </UnstyledButton>
          </Tooltip>
          <NavbarLink icon={IconSettings} label={t("SideBar.Settings")} url="/settings" />
        </Stack>
      </AppShellSection>
    </>
  );
}
