import { Box, Button, Center, Group, Image, Menu, Text } from "@mantine/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import * as classes from "./TopBar.css";

import { useColorScheme } from "@mantine/hooks";
const appWindow = getCurrentWebviewWindow();

function IconMinimize() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      transform="scale(0.8)"
    >
      <title>Minimize</title>
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
      <title>Maximize</title>
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
      <title>Close</title>
      <path
        d="M19 6.41l-1.41-1.41L12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        fill="currentColor"
      />
    </svg>
  );
}

type MenuAction = {
  label: string;
  shortcut?: string;
  action?: () => void;
};

type MenuGroup = {
  label: string;
  options: MenuAction[];
};

function TopBar({ menuActions }: { menuActions: MenuGroup[] }) {
  const colorScheme = useColorScheme();

  return (
    <>
      <Group>
        <Box style={{ flexGrow: 1 }}>
          <Group data-tauri-drag-region gap="xs" px="sm">
            <Box h="1.5rem" w="1.5rem">
              <Image src="/logo.png" fit="fill" />
            </Box>
            <Group gap={0}>
              {menuActions.map((action) => (
                <Menu
                  key={action.label}
                  shadow="md"
                  width={200}
                  position="bottom-start"
                  transitionProps={{ duration: 0 }}
                >
                  <Menu.Target>
                    <Button
                      style={{
                        ":active": {
                          transform: "none",
                        },
                      }}
                      fz="sm"
                      variant="subtle"
                      color={colorScheme === "dark" ? "gray" : "dark"}
                      size="compact-md"
                    >
                      {action.label}
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {action.options.map((option, i) =>
                      option.label === "divider" ? (
                        <Menu.Divider key={i} />
                      ) : (
                        <Menu.Item
                          key={option.label}
                          rightSection={
                            option.shortcut && (
                              <Text size="xs" c="dimmed">
                                {option.shortcut}
                              </Text>
                            )
                          }
                          onClick={option.action}
                        >
                          {option.label}
                        </Menu.Item>
                      ),
                    )}
                  </Menu.Dropdown>
                </Menu>
              ))}
            </Group>
          </Group>
        </Box>
        <Box h={35}>
          <Group gap={0} data-tauri-drag-region>
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
      </Group>
    </>
  );
}

export default TopBar;
