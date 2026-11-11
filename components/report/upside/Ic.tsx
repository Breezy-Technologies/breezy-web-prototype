// A Phosphor webfont icon (public/vendor/phosphor), standing in for
// @phosphor-icons/react in the ported report components.
export function Ic({ n, s = 16, b, c, className }: { n: string; s?: number; b?: boolean; c?: string; className?: string }) {
  return <i aria-hidden="true" className={`${b ? "ph-bold" : "ph"} ph-${n}${className ? " " + className : ""}`} style={{ fontSize: s, color: c, lineHeight: 1, display: "inline-block", flex: "none" }} />;
}
