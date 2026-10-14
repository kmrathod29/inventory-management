import { getBusinessDateISO } from "../utils/regional";

export function GregorianDatePicker({ value, onChange, disabled = false, className = "", invalid = false }) {
  return (
    <input
      type="date"
      className={`${className}${invalid ? " invalid" : ""}`}
      value={value || getBusinessDateISO()}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-label="Date (DD/MM/YYYY)"
    />
  );
}
