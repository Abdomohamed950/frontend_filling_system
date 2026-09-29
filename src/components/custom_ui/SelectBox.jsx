import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

/**
 * Controlled select used by the report/history filters.
 *
 * `items` may be plain strings or `{ value, label }` pairs so callers can
 * show a friendly Arabic label for a technical value.
 */
export default function SelectBox({
  label,
  items = [],
  value,
  onChange,
  placeholder,
  disabled,
  className = "w-48",
}) {
  const options = items.map((item) =>
    typeof item === "string" ? { value: item, label: item } : item
  );

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled} dir="rtl">
      <SelectTrigger className={className} aria-label={label}>
        <SelectValue placeholder={placeholder ?? label} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
