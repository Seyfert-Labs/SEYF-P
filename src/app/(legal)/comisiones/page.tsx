import type { Metadata } from "next";
import Link from "next/link";
import { DocHead } from "@/components/legal/DocHead";

export const metadata: Metadata = {
  title: "Comisiones — SEYF",
  description: "Lo que cuesta usar SEYF, sin letras chiquitas.",
};

const ROWS: [string, string, string][] = [
  ["Abrir tu cuenta", "$0", "Sin saldo mínimo."],
  ["Mantener tu cuenta", "$0", "Sin anualidad ni cargos mensuales."],
  ["Comisión de red Stellar", "$0", "La paga SEYF por ti. No necesitas comprar XLM."],
  ["Reserva para activar tu cuenta y USDC", "$0", "SEYF patrocina las reservas que pide la red."],
  ["Recibir USDC", "$0", ""],
  ["Enviar USDC", "$0", "Comisión de red pagada por SEYF."],
  ["Ahorro en bóveda: depositar y retirar", "$0", "SEYF no cobra. Ver nota sobre el rendimiento."],
  ["Adelanto de rendimiento", "$0", "Recibes hoy el rendimiento de tu plazo; ese rendimiento salda el adelanto."],
];

export default function Comisiones() {
  return (
    <>
      <DocHead
        eyebrow="Legal"
        title="Comisiones"
        lede="Lo que cuesta usar SEYF. Si algún día cambia, te avisamos antes; nunca te cobramos algo que no viste."
        updated
      />
      <article className="doc-body">
        <h2>Lo que cobra SEYF</h2>
        <div className="doc-scroll">
          <table className="doc-table">
            <thead>
              <tr><th>Concepto</th><th>Costo</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {ROWS.map(([what, cost, note]) => (
                <tr key={what}><td>{what}</td><td>{cost}</td><td>{note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>El rendimiento de la bóveda</h2>
        <p>
          El rendimiento lo generan protocolos de terceros (DeFindex y Blend). Esos protocolos pueden retener una
          parte del rendimiento según sus propias reglas antes de que llegue a tu bóveda. La tasa que te mostramos en
          la app es la que reporta la bóveda y es variable.
        </p>

        <h2>Próximamente</h2>
        <p>
          Los depósitos y retiros en pesos por SPEI, CETES y la conversión de divisas aún no están disponibles. Cuando
          lo estén, publicaremos aquí sus costos y te los mostraremos en la app antes de que confirmes cada operación.
        </p>

        <div className="doc-note">
          <p>
            Montos en pesos mexicanos, IVA incluido cuando aplique. Consulta también los{" "}
            <Link href="/terminos">Términos y Condiciones</Link>.
          </p>
        </div>
      </article>
    </>
  );
}
