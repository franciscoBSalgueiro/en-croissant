import {
  createStyles, Navbar,
  Stack,
  Tooltip,
  UnstyledButton
} from "@mantine/core";
import {
  IconChess,
  IconDatabase,
  IconHome2,
  IconLogout,
  IconRobot,
  IconSettings,
  IconSwitchHorizontal,
  IconUser,
  TablerIcon
} from "@tabler/icons";
import { useRouter } from "next/router";

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
  icon: TablerIcon;
  label: string;
  url: string;
  active?: boolean;
}

function NavbarLink({ url, icon: Icon, label, active }: NavbarLinkProps) {
  const { classes, cx } = useStyles();
  return (
    <Tooltip label={label} position="right" transitionDuration={0}>
      <a href={url}>
        <UnstyledButton
          className={cx(classes.link, {
            [classes.active]: active,
          })}
        >
          <Icon stroke={1.5} />
        </UnstyledButton>
      </a>
    </Tooltip>
  );
}

const linksdata = [
  { icon: IconChess, label: "Play", url: "/boards" },
  { icon: IconDatabase, label: "Databases", url: "/databases" },
  { icon: IconRobot, label: "Engines", url: "/engines" },
  { icon: IconUser, label: "Account", url: "/account" },
  { icon: IconSettings, label: "Settings", url: "/settings" },
];

export function SideBar() {
  const router = useRouter();

  const links = linksdata.map((link) => (
    <NavbarLink
      {...link}
      url={link.url}
      key={link.label}
      active={router.pathname === link.url}
    />
  ));

  return (
    <Navbar width={{ base: 80 }} p="md">
      <NavbarLink
        icon={IconHome2}
        url={"/"}
        active={router.pathname === "/"}
        label="Home"
      />
      <Navbar.Section grow mt={50}>
        <Stack justify="center" spacing={0}>
          {links}
        </Stack>
      </Navbar.Section>
      <Navbar.Section>
        <Stack justify="center" spacing={0}>
          <NavbarLink
            icon={IconSwitchHorizontal}
            label="Change account"
            url="/switch"
          />
          <NavbarLink icon={IconLogout} label="Logout" url="/logout" />
        </Stack>
      </Navbar.Section>
    </Navbar>
  );
}
