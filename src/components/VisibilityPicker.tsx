import type { Visibility } from "../../shared/types";

const OPTIONS: { value: Visibility; title: string; description: string }[] = [
  {
    value: "public",
    title: "Public",
    description: "Others see your Spotify display name and profile picture.",
  },
  {
    value: "anonymous",
    title: "Anonymous",
    description: 'Others see you as "Listener #1234" with no picture. Your matches still work.',
  },
  {
    value: "hidden",
    title: "Hidden",
    description: "You don't appear on anyone's graph. You can still see your own matches.",
  },
];

interface Props {
  value: Visibility;
  onChange: (v: Visibility) => void;
  disabled?: boolean;
}

export function VisibilityPicker({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="choices" disabled={disabled}>
      <legend>How should other users see you?</legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className={`choice ${value === o.value ? "selected" : ""}`}>
          <input
            type="radio"
            name="visibility"
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span>
            <strong>{o.title}</strong>
            <span className="muted small block">{o.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
