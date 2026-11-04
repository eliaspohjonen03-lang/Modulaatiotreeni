/** Valintapainikerivi (yksi valittuna kerrallaan). */
export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: readonly [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? "sel" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}
