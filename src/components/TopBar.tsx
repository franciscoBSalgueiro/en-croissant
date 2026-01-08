import { Box, Button, Center, Group, Image, Menu, Text } from "@mantine/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import * as classes from "./TopBar.css";

import { useColorScheme } from "@mantine/hooks";
const appWindow = getCurrentWebviewWindow();

function IconMinimize() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <title>Minimize</title>
      <path d="M3 8C3 7.72386 3.22386 7.5 3.5 7.5H12.5C12.7761 7.5 13 7.72386 13 8C13 8.27614 12.7761 8.5 12.5 8.5H3.5C3.22386 8.5 3 8.27614 3 8Z" />
    </svg>
  );
}

function IconMaximize() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <title>Maximize</title>
      <path d="M5.08496 4C5.29088 3.4174 5.8465 3 6.49961 3H9.99961C11.6565 3 12.9996 4.34315 12.9996 6V9.5C12.9996 10.1531 12.5822 10.7087 11.9996 10.9146V6C11.9996 4.89543 11.1042 4 9.99961 4H5.08496ZM4.5 5H9.5C10.3284 5 11 5.67157 11 6.5V11.5C11 12.3284 10.3284 13 9.5 13H4.5C3.67157 13 3 12.3284 3 11.5V6.5C3 5.67157 3.67157 5 4.5 5ZM4.5 6C4.22386 6 4 6.22386 4 6.5V11.5C4 11.7761 4.22386 12 4.5 12H9.5C9.77614 12 10 11.7761 10 11.5V6.5C10 6.22386 9.77614 6 9.5 6H4.5Z" />
    </svg>
  );
}

function IconX() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <title>Close</title>
      <path d="M2.58859 2.71569L2.64645 2.64645C2.82001 2.47288 3.08944 2.4536 3.28431 2.58859L3.35355 2.64645L8 7.293L12.6464 2.64645C12.8417 2.45118 13.1583 2.45118 13.3536 2.64645C13.5488 2.84171 13.5488 3.15829 13.3536 3.35355L8.707 8L13.3536 12.6464C13.5271 12.82 13.5464 13.0894 13.4114 13.2843L13.3536 13.3536C13.18 13.5271 12.9106 13.5464 12.7157 13.4114L12.6464 13.3536L8 8.707L3.35355 13.3536C3.15829 13.5488 2.84171 13.5488 2.64645 13.3536C2.45118 13.1583 2.45118 12.8417 2.64645 12.6464L7.293 8L2.64645 3.35355C2.47288 3.17999 2.4536 2.91056 2.58859 2.71569L2.64645 2.64645L2.58859 2.71569Z" />
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
            <Box h="1.25rem" w="1.25rem">
              <Image src="/logo.png" fit="fill" />
            </Box>
            <Group gap={0}>
              {menuActions.map((action) => (
                <Menu
                  key={action.label}
                  offset={2}
                  shadow="md"
                  width={200}
                  position="bottom-start"
                  transitionProps={{ duration: 0 }}
                >
                  <Menu.Target>
                    <Button
                      styles={{
                        root: {
                          transform: "none",
                        },
                        label: {
                          fontWeight: "normal",
                        },
                      }}
                      fz="0.8rem"
                      variant="subtle"
                      color={colorScheme === "dark" ? "gray" : "dark"}
                      size="compact-xs"
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
                          fz="0.8rem"
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
        <Box>
          <Group gap={0} data-tauri-drag-region>
            <Center
              h="2.25rem"
              w={45}
              onClick={() => appWindow.minimize()}
              className={classes.icon}
            >
              <IconMinimize />
            </Center>
            <Center
              h="2.25rem"
              w={45}
              onClick={() => appWindow.toggleMaximize()}
              className={classes.icon}
            >
              <IconMaximize />
            </Center>
            <Center
              h="2.25rem"
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
