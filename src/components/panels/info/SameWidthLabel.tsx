// Shows one label while keeping room for the longest of several, so buttons that use it keep the
// same width whichever label they show
export default function SameWidthLabel({ label, all }: { label: string; all: string[] }) {
  const shown = all.indexOf(label);
  return (
    <span style={{ display: "grid", justifyItems: "center" }}>
      {all.map((text, i) => (
        <span key={i} style={{ gridArea: "1 / 1", visibility: i === shown ? "visible" : "hidden" }}>
          {text}
        </span>
      ))}
    </span>
  );
}
