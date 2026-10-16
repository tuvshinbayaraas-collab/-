// The dark backdrop behind a popup: a click on it closes the popup, but a drag that only ends on it (selecting text
// inside the popup, say) doesn't.
import {useRef, type MouseEvent, type PointerEvent} from 'react';

export function useBackdrop(onClose: () => void) {
  const pressed = useRef(false);
  return {
    onPointerDown: (e: PointerEvent) => {
      pressed.current = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent) => {
      if (pressed.current && e.target === e.currentTarget) onClose();
      pressed.current = false;
    },
  };
}
