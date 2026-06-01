import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";

import ChevronIcon from "../../icons/ChevronIcon";
import "./Select.css";

function normalizeOptions(children) {
    return Children.toArray(children)
        .filter((child) => isValidElement(child) && child.type === "option")
        .map((child) => ({
            value: String(child.props.value ?? ""),
            label: child.props.children,
            disabled: Boolean(child.props.disabled),
        }));
}

function extractText(value) {
    if (value === null || value === undefined || typeof value === "boolean") {
        return "";
    }
    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.map(extractText).join("");
    }
    if (isValidElement(value)) {
        return extractText(value.props?.children);
    }
    return "";
}

function Select({
    id,
    label,
    hint,
    error,
    value,
    defaultValue,
    onChange,
    name,
    disabled = false,
    fitToOptions = false,
    fullWidth = false,
    className = "",
    selectClassName = "",
    children,
    ...props
}) {
    const generatedId = useId();
    const selectId = id || generatedId;
    const listboxId = `${selectId}-listbox`;
    const rootRef = useRef(null);
    const options = useMemo(() => normalizeOptions(children), [children]);
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState(() => {
        if (defaultValue !== undefined) {
            return String(defaultValue);
        }
        return options[0]?.value || "";
    });
    const [isOpen, setIsOpen] = useState(false);

    const selectedValue = isControlled ? String(value) : internalValue;
    const selectedOption = options.find((option) => option.value === selectedValue) || null;
    const selectedLabel = selectedOption?.label || "";
    const maxLabelLength = useMemo(() => {
        const maxLength = options.reduce((accumulator, option) => {
            const length = extractText(option.label).trim().length;
            return Math.max(accumulator, length);
        }, 0);

        return Math.max(maxLength, 1);
    }, [options]);

    useEffect(() => {
        if (isControlled || options.length === 0) {
            return;
        }
        const exists = options.some((option) => option.value === internalValue);
        if (!exists) {
            setInternalValue(options[0].value);
        }
    }, [isControlled, options, internalValue]);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen]);

    const emitChange = (nextValue) => {
        if (!isControlled) {
            setInternalValue(nextValue);
        }
        onChange?.({
            target: { value: nextValue, name, id: selectId },
            currentTarget: { value: nextValue, name, id: selectId },
        });
    };

    const handleOptionSelect = (nextValue) => {
        emitChange(nextValue);
        setIsOpen(false);
    };

    const handleButtonKeyDown = (event) => {
        if (disabled) {
            return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            if (options.length === 0) {
                return;
            }
            const currentIndex = options.findIndex((option) => option.value === selectedValue);
            const delta = event.key === "ArrowDown" ? 1 : -1;
            const startIndex = currentIndex >= 0 ? currentIndex : 0;
            const nextIndex = (startIndex + delta + options.length) % options.length;
            const nextOption = options[nextIndex];
            if (nextOption && !nextOption.disabled) {
                emitChange(nextOption.value);
            }
        }
    };

    const rootClass = [
        "ui-select",
        fitToOptions ? "ui-select--fit-to-options" : "",
        fullWidth ? "ui-select--full-width" : "",
        error ? "has-error" : "",
        isOpen ? "is-open" : "",
        className,
    ].filter(Boolean).join(" ");

    const fieldClass = [
        "ui-select__field",
        selectClassName,
    ].filter(Boolean).join(" ");

    return (
        <div
            className={rootClass}
            ref={rootRef}
            style={fitToOptions ? { "--ui-select-min-ch": maxLabelLength } : undefined}
        >
            {label ? <label className="ui-select__label" htmlFor={selectId}>{label}</label> : null}
            <div className="ui-select__control">
                <button
                    id={selectId}
                    type="button"
                    className={fieldClass}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? listboxId : undefined}
                    disabled={disabled}
                    onClick={() => setIsOpen((prevState) => !prevState)}
                    onKeyDown={handleButtonKeyDown}
                    {...props}
                >
                    <span className="ui-select__value">{selectedLabel}</span>
                </button>
                <span className="ui-select__icon" aria-hidden="true">
                    <ChevronIcon direction="down" />
                </span>
                {
                    isOpen &&
                    <div className="ui-select__menu" id={listboxId} role="listbox" aria-labelledby={selectId}>
                        {
                            options.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="option"
                                    className={`ui-select__option ${option.value === selectedValue ? "is-selected" : ""}`}
                                    aria-selected={option.value === selectedValue}
                                    disabled={option.disabled}
                                    onClick={() => handleOptionSelect(option.value)}
                                >
                                    {option.label}
                                </button>
                            ))
                        }
                    </div>
                }
                {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
            </div>
            {error ? <span className="ui-select__error">{error}</span> : hint ? <span className="ui-select__hint">{hint}</span> : null}
        </div>
    );
}

export default Select;
