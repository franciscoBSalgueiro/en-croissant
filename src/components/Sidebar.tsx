import { createStyles, Navbar, Stack, Tooltip } from "@mantine/core";
import {
  Icon,
  IconChess,
  IconDatabase,
  IconFiles,
  IconRobot,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { NavLink } from "react-router-dom";

const useStyles = createStyles((theme) => ({
  link: {
    width: "3rem",
    height: "3rem",
    display: "flex",
    alignItems: "center",
    borderLeft: "3px solid transparent",
    borderRight: "3px solid transparent",
    justifyContent: "center",
    color:
      theme.colorScheme === "dark"
        ? theme.colors.dark[0]
        : theme.colors.gray[7],

    "&:hover": {
      color:
        theme.colorScheme === "dark"
          ? theme.colors.gray[0]
          : theme.colors.dark[5],
    },
  },

  active: {
    "&, &:hover": {
      borderLeftColor: theme.colors[theme.primaryColor],
      color: theme.colorScheme === "dark" ? theme.white : theme.colors.dark[5],
    },
  },
}));

interface NavbarLinkProps {
  icon: Icon;
  label: string;
  url: string;
  active?: boolean;
}

function NavbarLink({ url, icon: Icon, label }: NavbarLinkProps) {
  const { classes, cx } = useStyles();
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
    <Navbar width={{ base: "3rem" }}>
      <Navbar.Section grow>
        <Stack justify="center" spacing={0}>
          {links}
        </Stack>
      </Navbar.Section>
      <Navbar.Section>
        <Stack justify="center" spacing={0}>
          <NavbarLink icon={IconSettings} label="Settings" url="/settings" />
        </Stack>
      </Navbar.Section>
    </Navbar>
  );
}
