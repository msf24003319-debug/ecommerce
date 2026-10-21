"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { orderStatusLabel } from "@/lib/utils";

export function OrderStatusSelect({
  value,
  options,
  allowedOptions = options,
  disabled,
  onChange,
}: {
  value: string;
  options: string[];
  allowedOptions?: string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function choose(index: number) {
    if (!allowedOptions.includes(options[index])) return;
    if (options[index]) onChange(options[index]);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className="order-status-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id={`${id}-label`}>New status</span>
      <input type="hidden" name="status" value={value} disabled={disabled} />
      <button
        type="button"
        ref={trigger}
        className="order-status-trigger"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-expanded={open && !disabled}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
        aria-activedescendant={
          open && !disabled ? `${id}-${active}` : undefined
        }
        disabled={disabled}
        onClick={() => {
          setActive(Math.max(0, options.indexOf(value)));
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (
            [
              "ArrowDown",
              "ArrowUp",
              "Home",
              "End",
              "Enter",
              " ",
              "Escape",
            ].includes(event.key)
          ) {
            event.preventDefault();
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              if (open) choose(active);
              else {
                setActive(Math.max(0, options.indexOf(value)));
                setOpen(true);
              }
              return;
            }
            setOpen(true);
            if (event.key === "Home") setActive(0);
            else if (event.key === "End") setActive(options.length - 1);
            else
              setActive(
                (index) =>
                  (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    options.length) %
                  options.length,
              );
          } else if (event.key.length === 1) {
            const index = options.findIndex((option) =>
              orderStatusLabel(option)
                .toLowerCase()
                .startsWith(event.key.toLowerCase()),
            );
            if (index >= 0) {
              event.preventDefault();
              setOpen(true);
              setActive(index);
            }
          }
        }}
      >
        <span>{orderStatusLabel(value)}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && !disabled && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="order-status-menu"
        >
          {options.map((option, index) => (
            <li
              key={option}
              id={`${id}-${index}`}
              role="option"
              aria-selected={option === value}
              aria-disabled={!allowedOptions.includes(option)}
              data-active={index === active}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{orderStatusLabel(option)}</span>
              {option === value && <Check size={16} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
