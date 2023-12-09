import { Button, Group, Stack, Text, Tooltip } from "@mantine/core";
import { ReactNode } from "react";

interface ToggleButtonGroupProps<T> {
    label: string;
    options: ToggleButtonGroupOption<T>[];
    includeTooltips?: boolean;
    minButtonWidth?: string;
    toggleOption(option: T): void;
}

export interface ToggleButtonGroupOption<T> {
    content: ReactNode,
    name: string,
    value: T,
    isToggled: boolean
}

function ToggleButtonGroup<T>(props: ToggleButtonGroupProps<T>) {

    const getButton = (option: ToggleButtonGroupOption<T>) => (
        <Button key={option.name}
            variant={option.isToggled ? "filled" : "default"}
            radius={0}
            onClick={() => props.toggleOption(option.value)}
            miw={props.minButtonWidth}
        >
            {option.content}
        </Button>
    );

    return (
        //this could use <InputWrapper> for the label instead if updating mantine to 7
        <Stack justify="flex-start" gap={0}>
            <Text fw={500} size="sm">{props.label}</Text>
            <Group gap={0}>
                {props.options.map(option => {
                    if (props.includeTooltips) {
                        return (
                            <Tooltip label={option.name} key={option.name}>
                                {getButton(option)}
                            </Tooltip>
                        );
                    } else {
                        return (getButton(option));
                    }
                })}
            </Group>
        </Stack>
    )
}

export default ToggleButtonGroup;