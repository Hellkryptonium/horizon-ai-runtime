import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

export function PublicShell({ children }: { children: ReactNode }) { return <div className="public-site"><Navbar />{children}<Footer /></div>; }
