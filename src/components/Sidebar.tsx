import { AppShellSection, Stack, Tooltip } from "@mantine/core";
import {
  Icon,
  IconChess,
  IconDatabase,
  IconFiles,
  IconRobot,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import cx from "clsx";
import { NavLink } from "react-router-dom";
import * as classes from "./Sidebar.css";

interface NavbarLinkProps {
  icon: Icon;
  label: string;
  url: string;
  active?: boolean;
}

function NavbarLink({ url, icon: Icon, label }: NavbarLinkProps) {
  return (
    <Tooltip label={label} position="right">
      <NavLink
        to={url}
        className={({ isActive }) => {
          return cx(classes.link, {
            [classes.active]: isActive,
          });
        }}
      >
        <Icon size="1.5rem" stroke={1.5} />
      </NavLink>
    </Tooltip>
  );
}

const linksdata = [
  { icon: IconUser, label: "User", url: "/" },
  { icon: IconChess, label: "Board", url: "/boards" },
  { icon: IconFiles, label: "Files", url: "/files" },
  {
    icon: IconDatabase,
    label: "Databases",
    url: "/databases",
  },
  { icon: IconRobot, label: "Engines", url: "/engines" },
];

export function SideBar() {
  const links = linksdata.map((link) => (
    <NavbarLink {...link} key={link.label} />
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
          <NavbarLink icon={IconSettings} label="Settings" url="/settings" />
        </Stack>
      </AppShellSection>
    </>
  );
}
