"use client";

export function FormField({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
  maxLength,
  optional,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
  maxLength?: number;
  optional?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {optional && <span className="text-gray-400 font-normal ml-1">(선택)</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm disabled:bg-gray-50 disabled:text-gray-500 ${
          error ? "border-red-300" : "border-gray-300"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  error,
  optional,
  suffix,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
  error?: string;
  optional?: boolean;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {optional && <span className="text-gray-400 font-normal ml-1">(선택)</span>}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={placeholder || "0"}
          min={0}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm ${
            error ? "border-red-300" : "border-gray-300"
          } ${suffix ? "pr-12" : ""}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300"
      />
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  placeholder,
  optional,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  const displayValue = value ? value.toLocaleString("ko-KR") : "";
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {optional && <span className="text-gray-400 font-normal ml-1">(선택)</span>}
      </label>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          const num = Number(e.target.value.replace(/,/g, "")) || 0;
          onChange(num || null);
        }}
        placeholder={placeholder || "0"}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
      />
      {value && value > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          {value >= 100000000
            ? `${(value / 100000000).toFixed(1)}억원`
            : `${Math.round(value / 10000).toLocaleString()}만원`}
        </p>
      )}
    </div>
  );
}
