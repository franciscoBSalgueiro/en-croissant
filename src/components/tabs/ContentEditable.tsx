import React, { useEffect, useRef } from "react";
import ReactContentEditable, {
  ContentEditableEvent,
} from "react-contenteditable";

interface ContentEditableProps {
  onChange?: (event: ContentEditableEvent) => void;
  onBlur?: (event: React.FormEvent<HTMLDivElement>) => void;
  onInput?: (event: React.FormEvent<HTMLDivElement>) => void;
  onKeyPress?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  html: string;
  className?: string;
  innerRef?: React.RefObject<HTMLDivElement>;
  disabled?: boolean;
}

export const ContentEditable: React.FC<ContentEditableProps> = ({
  onChange,
  onInput,
  onBlur,
  onKeyPress,
  onKeyDown,
  ...props
}) => {
  const onChangeRef = useRef(onChange);
  const onInputRef = useRef(onInput);
  const onBlurRef = useRef(onBlur);
  const onKeyPressRef = useRef(onKeyPress);
  const onKeyDownRef = useRef(onKeyDown);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);
  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);
  useEffect(() => {
    onKeyPressRef.current = onKeyPress;
  }, [onKeyPress]);
  useEffect(() => {
    onKeyDownRef.current = onKeyDown;
  }, [onKeyDown]);

  return (
    <ReactContentEditable
      {...props}
      innerRef={props.innerRef}
      onFocus={() => document.execCommand("selectAll", false, undefined)}
      className={props.className}
      onChange={
        onChange
          ? (...args) => {
              if (onChangeRef.current) {
                onChangeRef.current(...args);
              }
            }
          : () => undefined
      }
      onInput={
        onInput
          ? (...args) => {
              if (onInputRef.current) {
                onInputRef.current(...args);
              }
            }
          : undefined
      }
      onBlur={
        onBlur
          ? (...args) => {
              if (onBlurRef.current) {
                onBlurRef.current(...args);
              }
            }
          : undefined
      }
      onKeyPress={
        onKeyPress
          ? (...args) => {
              if (onKeyPressRef.current) {
                onKeyPressRef.current(...args);
              }
            }
          : undefined
      }
      onKeyDown={
        onKeyDown
          ? (...args) => {
              if (onKeyDownRef.current) {
                onKeyDownRef.current(...args);
              }
            }
          : undefined
      }
    />
  );
};
