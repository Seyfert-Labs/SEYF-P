import type { Metadata } from "next";
import { DocHead, Mail } from "@/components/legal/DocHead";
import { LEGAL } from "@/config/legal";

export const metadata: Metadata = {
  title: "Prensa — SEYF",
  description: "Información y recursos de marca de SEYF para medios.",
};

const ASSETS: [string, string][] = [
  ["/brand/seyf-horizontal-dark.svg", "Logo horizontal (fondo oscuro)"],
  ["/brand/seyf-horizontal-light.svg", "Logo horizontal (fondo claro)"],
  ["/brand/seyf-symbol.svg", "Símbolo"],
  ["/brand/seyf-appicon.svg", "Ícono de app"],
];

export default function Prensa() {
  return (
    <>
      <DocHead eyebrow="Compañía" title="Prensa" lede="Información y recursos para medios de comunicación." />
      <article className="doc-body">
        <div className="doc-cards">
          <div className="doc-card">
            <h3>Contacto de prensa</h3>
            <p><Mail to={LEGAL.emails.press} /></p>
          </div>
          <div className="doc-card">
            <h3>Inversionistas</h3>
            <p><Mail to={LEGAL.emails.investors} /></p>
          </div>
        </div>

        <h2>SEYF en una línea</h2>
        <p>
          SEYF es la app de ahorro e inversión para México construida sobre Stellar: entras con tu correo, ves todo en
          pesos y tu ahorro genera rendimiento, sin seed phrase ni comisiones de red.
        </p>

        <h2>Datos clave</h2>
        <ul>
          <li>Producto de Seyfert Labs, equipo mexicano.</li>
          <li>Construido sobre la red Stellar, con Pollar, DeFindex, Blend y Etherfuse.</li>
          <li>
            Disponible hoy: ahorro en USDC con rendimiento y adelanto de rendimiento. Próximamente: depósitos en pesos
            por SPEI y CETES.
          </li>
        </ul>

        <h2>Recursos de marca</h2>
        <p>Puedes usar estos archivos para hablar de SEYF. Por favor no los modifiques ni cambies sus colores.</p>
        <ul>
          {ASSETS.map(([href, label]) => (
            <li key={href}><a href={href} download>{label}</a> (SVG)</li>
          ))}
        </ul>
      </article>
    </>
  );
}
