import { Button, Stack, Text, Tooltip } from "@mantine/core";
import { ReactNode } from "react";

interface ToggleButtonGridProps<T> {
    label: string;
    options: { content: ReactNode, name: string, value: T, isToggled: boolean }[];
    includeTooltips?: boolean;
    toggleOption(option: T): void;
}

function ToggleButtonGroup<T>(props: ToggleButtonGridProps<T>) {
    return (
        //this could use <InputWrapper> for the label instead if updating mantine to 7
        <Stack justify="flex-start" spacing={0}>
            <Text weight={500} size="sm">{props.label}</Text>
            <Button.Group>
                {props.options.map(option => {
                    if (props.includeTooltips) {
                        return (
                            <Tooltip label={option.name} key={option.name}>
                                <Button
                                    variant={option.isToggled ? "filled" : "default"}
                                    onClick={() => props.toggleOption(option.value)}
                                >
                                    {option.content}
                                </Button>
                            </Tooltip>
                        );
                    } else {
                        return (
                            <Button key={option.name}
                                variant={option.isToggled ? "filled" : "default"}
                                onClick={() => props.toggleOption(option.value)}
                            >
                                {option.content}
                            </Button>
                        );
                    }
                })}
            </Button.Group>
        </Stack>
    )
}

export default ToggleButtonGroup;