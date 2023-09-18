import {
  createStyles,
  Navbar,
  Stack,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  Icon,
  IconChess,
  IconDatabase,
  IconFiles,
  IconRobot,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";

const useStyles = createStyles((theme) => ({
  link: {
    width: 50,
    height: 50,
    borderRadius: theme.radius.md,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color:
      theme.colorScheme === "dark"
        ? theme.colors.dark[0]
        : theme.colors.gray[7],

    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[5]
          : theme.colors.gray[0],
    },
  },

  active: {
    "&, &:hover": {
      backgroundColor: theme.fn.variant({
        variant: "light",
        color: theme.primaryColor,
      }).background,
      color: theme.fn.variant({
        variant: "light",
        color: theme.primaryColor,
      }).color,
    },
  },
}));

interface NavbarLinkProps {
  icon: Icon;
  label: string;
  url: string;
  active?: boolean;
}

function NavbarLink({ url, icon: Icon, label, active }: NavbarLinkProps) {
  const { classes, cx } = useStyles();
  return (
    <Tooltip label={label} position="right">
      <Link to={url}>
        <UnstyledButton
          className={cx(classes.link, {
            [classes.active]: active,
          })}
        >
          <Icon stroke={1.5} />
        </UnstyledButton>
      </Link>
    </Tooltip>
  );
}

const linksdata = [
  { icon: IconUser, label: "User", url: ["/"] },
  { icon: IconChess, label: "Board", url: ["/boards"] },
  { icon: IconFiles, label: "Files", url: ["/files"] },
  { icon: IconDatabase, label: "Databases", url: ["/databases", "/db/view"] },
  { icon: IconRobot, label: "Engines", url: ["/engines"] },
];

export function SideBar() {
  const { pathname } = useLocation();

  const links = linksdata.map((link) => (
    <NavbarLink
      {...link}
      url={link.url[0]}
      key={link.label}
      active={link.url.includes(pathname)}
    />
  ));

  return (
    <Navbar width={{ base: 80 }} p="md">
      <Navbar.Section grow mt={100}>
        <Stack justify="center" spacing={0}>
          {links}
        </Stack>
      </Navbar.Section>
      <Navbar.Section>
        <Stack justify="center" spacing={0}>
          <NavbarLink
            icon={IconSettings}
            label="Settings"
            url="/settings"
            active={pathname === "/settings"}
          />
        </Stack>
      </Navbar.Section>
    </Navbar>
  );
}
