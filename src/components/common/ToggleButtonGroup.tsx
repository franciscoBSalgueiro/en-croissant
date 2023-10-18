import { Button, Group, Stack, Text, Tooltip } from "@mantine/core";
import { ReactNode } from "react";

interface ToggleButtonGroupProps<T> {
    label: string;
    options: { content: ReactNode, name: string, value: T, isToggled: boolean }[];
    includeTooltips?: boolean;
    minButtonWidth?: string;
    toggleOption(option: T): void;
}

function ToggleButtonGroup<T>(props: ToggleButtonGroupProps<T>) {
    return (
        //this could use <InputWrapper> for the label instead if updating mantine to 7
        <Stack justify="flex-start" spacing={0}>
            <Text weight={500} size="sm">{props.label}</Text>
            <Group spacing={0}>
                {props.options.map(option => {
                    if (props.includeTooltips) {
                        return (
                            <Tooltip label={option.name} key={option.name}>
                                <Button
                                    variant={option.isToggled ? "filled" : "default"}
                                    radius={0}
                                    onClick={() => props.toggleOption(option.value)}
                                    miw={props.minButtonWidth}
                                >
                                    {option.content}
                                </Button>
                            </Tooltip>
                        );
                    } else {
                        return (
                            <Button key={option.name}
                                variant={option.isToggled ? "filled" : "default"}
                                radius={0}
                                onClick={() => props.toggleOption(option.value)}
                                miw={props.minButtonWidth}
                            >
                                {option.content}
                            </Button>
                        );
                    }
                })}
            </Group>
        </Stack>
    )
}

export default ToggleButtonGroup;