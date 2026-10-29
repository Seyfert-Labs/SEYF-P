import Link from "next/link";
import "./legal.css";
import { SeyfSymbol } from "@/components/brand/SeyfLogo";
import { LEGAL, pending } from "@/config/legal";

/* Páginas institucionales (legal, soporte, compañía): mismo look de la landing,
   sin animaciones, pensadas para leerse. */
const LINKS: [string, string][] = [
  ["/terminos", "Términos"],
  ["/privacidad", "Privacidad"],
  ["/comisiones", "Comisiones"],
  ["/soporte", "Soporte"],
  ["/nosotros", "Nosotros"],
  ["/empleos", "Empleos"],
  ["/prensa", "Prensa"],
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="doc-root">
      <header className="doc-nav">
        <div className="doc-wrap doc-nav-in">
          <Link href="/" className="doc-brand">
            <span className="mk"><SeyfSymbol size={18} /></span> SEYF
          </Link>
          <Link href="/app" className="doc-cta">Iniciar sesión</Link>
        </div>
      </header>
      <main className="doc-wrap">{children}</main>
      <footer className="doc-foot">
        <div className="doc-wrap">
          <nav className="doc-foot-links">
            {LINKS.map(([href, label]) => (
              <Link key={href} href={href}>{label}</Link>
            ))}
          </nav>
          <p>
            © 2026 {pending(LEGAL.legalName, "razón social")}. SEYF no es una institución de crédito. Construido sobre
            Stellar · Hecho en México.
          </p>
        </div>
      </footer>
    </div>
  );
}
