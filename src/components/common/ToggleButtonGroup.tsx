import { Button, Group, InputWrapper, Tooltip } from "@mantine/core";
import type { ReactNode } from "react";

interface ToggleButtonGroupProps<T> {
  label: string;
  options: ToggleButtonGroupOption<T>[];
  includeTooltips?: boolean;
  minButtonWidth?: string;
  toggleOption(option: T): void;
}

export interface ToggleButtonGroupOption<T> {
  content: ReactNode;
  name: string;
  value: T;
  isToggled: boolean;
}

function ToggleButtonGroup<T>(props: ToggleButtonGroupProps<T>) {
  const getButton = (option: ToggleButtonGroupOption<T>) => (
    <Button
      key={option.name}
      variant={option.isToggled ? "filled" : "default"}
      radius={0}
      onClick={() => props.toggleOption(option.value)}
      miw={props.minButtonWidth}
    >
      {option.content}
    </Button>
  );

  return (
    <InputWrapper label={props.label} required={false}>
      <Group gap={0}>
        {props.options.map((option) => {
          if (props.includeTooltips) {
            return (
              <Tooltip label={option.name} key={option.name}>
                {getButton(option)}
              </Tooltip>
            );
          }
          return getButton(option);
        })}
      </Group>
    </InputWrapper>
  );
}

export default ToggleButtonGroup;
