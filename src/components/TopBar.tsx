import {
  Box,
  Button,
  Center,
  Flex,
  Group,
  Header,
  createStyles,
} from "@mantine/core";
import { appWindow } from "@tauri-apps/api/window";

function IconMinimize() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      transform="scale(0.8)"
    >
      <path d="M19 13H5v-2h14v2z" fill="currentColor" />
    </svg>
  );
}

function IconMaximize() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      transform="scale(0.8)"
    >
      <path d="M19 5H5v14h14V5zm-2 12H7V7h10v10z" fill="currentColor" />
    </svg>
  );
}

function IconX() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      transform="scale(0.8)"
    >
      <path
        d="M19 6.41l-1.41-1.41L12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        fill="currentColor"
      />
    </svg>
  );
}

const useStyles = createStyles((theme) => ({
  icon: {
    transition: "background-color 100ms ease",
    "&:hover": {
      backgroundColor: theme.colors.dark[5],
    },
  },
  close: {
    transition: "background-color 100ms ease",
    "&:hover": {
      backgroundColor: theme.colors.red[7],
      color: theme.white,
    },
  },
}));

function TopBar() {
  const { classes } = useStyles();
  return (
    <Header height={35} data-tauri-drag-region>
      <Flex h={35} align="end">
        <Box sx={{ flexGrow: 1 }} p={5}>
          <Group>
            <img src="/logo.png" width={20} height={20} />
            <Group spacing={0}>
              <Button variant="subtle" color="gray" compact>
                File
              </Button>
              <Button variant="subtle" color="gray" compact>
                Search
              </Button>
              <Button variant="subtle" color="gray" compact>
                Help
              </Button>
            </Group>
          </Group>
        </Box>
        <Box h={35}>
          <Group spacing={0}>
            <Center
              h={35}
              w={45}
              onClick={() => appWindow.minimize()}
              className={classes.icon}
            >
              <IconMinimize />
            </Center>
            <Center
              h={35}
              w={45}
              onClick={() => appWindow.toggleMaximize()}
              className={classes.icon}
            >
              <IconMaximize />
            </Center>
            <Center
              h={35}
              w={45}
              onClick={() => appWindow.close()}
              className={classes.close}
            >
              <IconX />
            </Center>
          </Group>
        </Box>
      </Flex>
    </Header>
  );
}

export default TopBar;
