import type { ReactNode } from "react";

export function SectionHeading({ eyebrow, title, children, align = "left" }: { eyebrow: string; title: string; children?: ReactNode; align?: "left" | "center" }) { return <div className={`public-section-heading align-${align}`}><div className="public-eyebrow">{eyebrow}</div><h2>{title}</h2>{children && <p>{children}</p>}</div>; }
