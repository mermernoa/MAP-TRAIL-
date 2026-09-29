interface Props {
  label: string;
  stops: number[];
  value: [number, number];
  onChange: (value: [number, number]) => void;
  format: (v: number) => string;
}

/**
 * Double curseur sur des crans non linéaires. Deux `input[type=range]`
 * superposés : chaque poignée reste utilisable au clavier.
 */
export function RangeSlider({ label, stops, value, onChange, format }: Props) {
  const toIndex = (v: number) => {
    const i = stops.findIndex((s) => s >= v);
    return i === -1 ? stops.length - 1 : i;
  };
  const lo = toIndex(value[0]);
  const hi = toIndex(value[1]);
  const max = stops.length - 1;
  const text = (i: number) => (stops[i] === Infinity ? 'sans limite' : format(stops[i]));
  const summary =
    lo === 0 && hi === max
      ? 'Toutes'
      : hi === max
        ? `${format(stops[lo])} et plus`
        : lo === 0
          ? `Jusqu'à ${format(stops[hi])}`
          : `${format(stops[lo])} à ${format(stops[hi])}`;

  return (
    <div className="range">
      <div className="range-head">
        <span className="range-label">{label}</span>
        <span className="range-value">{summary}</span>
      </div>
      <div className="range-track" style={{ '--lo': lo / max, '--hi': hi / max } as React.CSSProperties}>
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={lo}
          aria-label={`${label}, minimum`}
          aria-valuetext={text(lo)}
          onChange={(e) => {
            const i = Math.min(Number(e.target.value), hi);
            onChange([stops[i], stops[hi]]);
          }}
        />
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={hi}
          aria-label={`${label}, maximum`}
          aria-valuetext={text(hi)}
          onChange={(e) => {
            const i = Math.max(Number(e.target.value), lo);
            onChange([stops[lo], stops[i]]);
          }}
        />
      </div>
    </div>
  );
}
