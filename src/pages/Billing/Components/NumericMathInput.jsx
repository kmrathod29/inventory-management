import { forwardRef } from "react";
import { commitMath, evalMath } from "../../../utils/evalMath";

// A numeric field that accepts simple math expressions (500+120, 5*100,
// 1000/4) and evaluates them on Enter / blur. Uses type="text" so operators
// can be typed (a native number input rejects them).
//
// Props:
//   value, onChange(str)          controlled value
//   onCommit(number|null)         called after evaluation (Enter/blur)
//   onEnter()                     called after commit when Enter is pressed
//   onNavigate("prev"|"next")     Arrow navigation between fields
//   stepper                       +/- (and stepping) adjust value by +/-1
//   min                           clamp for the stepper (default 1)
//   selectOnFocus                 select all text on focus
export const NumericMathInput = forwardRef(function NumericMathInput(
  {
    value,
    onChange,
    onCommit,
    onEnter,
    onNavigate,
    stepper = false,
    min = 1,
    selectOnFocus = false,
    onFocus,
    onBlur,
    disabled,
    ...rest
  },
  ref,
) {
  function commit() {
    const result = evalMath(value);
    onChange?.(commitMath(value));
    onCommit?.(result);
    return result;
  }

  function step(delta) {
    const current = evalMath(value);
    const base = current === null ? 0 : current;
    const nextVal = Math.max(min, base + delta);
    onChange?.(String(nextVal));
  }

  function handleKeyDown(e) {
    if (disabled) return;

    // Shift+Enter is a global shortcut (add item) — let it bubble.
    if (e.shiftKey && e.key === "Enter") return;

    if (stepper && (e.key === "+" || e.key === "-")) {
      e.preventDefault();
      step(e.key === "+" ? 1 : -1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      onEnter?.();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      onNavigate?.("prev");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onNavigate?.("next");
      return;
    }
    // Navigate only at the text boundaries so caret movement still works.
    if (e.key === "ArrowLeft" && e.target.selectionStart === 0 && e.target.selectionEnd === 0) {
      e.preventDefault();
      onNavigate?.("prev");
      return;
    }
    if (
      e.key === "ArrowRight" &&
      e.target.selectionStart === value.length &&
      e.target.selectionEnd === value.length
    ) {
      e.preventDefault();
      onNavigate?.("next");
    }
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        if (selectOnFocus) e.target.select();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        commit();
        onBlur?.(e);
      }}
      {...rest}
    />
  );
});
