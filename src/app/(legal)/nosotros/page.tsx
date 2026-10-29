import type { Metadata } from "next";
import Link from "next/link";
import { DocHead } from "@/components/legal/DocHead";

export const metadata: Metadata = {
  title: "Nosotros — SEYF",
  description: "Por qué existe SEYF y cómo trabajamos.",
};

export default function Nosotros() {
  return (
    <>
      <DocHead
        eyebrow="Compañía"
        title="Que tu dinero trabaje para ti, no al revés."
        lede="SEYF es la app de ahorro e inversión para México construida sobre Stellar."
      />
      <article className="doc-body">
        <h2>Por qué existimos</h2>
        <p>
          Millones de personas en México ahorran en el banco a una tasa cercana a cero o en una Afore que casi nunca
          ven. Mientras tanto, la inflación se come su dinero todos los días. Las herramientas para hacerlo rendir
          existen, pero suelen venir con jerga, comisiones y letras chiquitas.
        </p>
        <p>
          SEYF lo hace simple: entras con tu correo, ves todo en pesos y tu ahorro genera rendimiento. Sin seed
          phrase, sin comprar criptomonedas para pagar comisiones y sin tecnicismos.
        </p>

        <h2>Cómo trabajamos</h2>
        <ul>
          <li>
            <strong>Tu dinero primero.</strong> SEYF nunca tiene tu llave: cada movimiento lo firmas tú.
          </li>
          <li>
            <strong>Honestidad.</strong> Lo que está disponible lo puedes verificar en la red Stellar. Lo que aún no
            está listo lo marcamos como &ldquo;Próximamente&rdquo;.
          </li>
          <li>
            <strong>Construir sobre lo que ya es seguro.</strong> Usamos protocolos y proveedores probados del
            ecosistema Stellar (Pollar, DeFindex, Blend, Etherfuse) y escribimos código propio solo donde aporta algo
            distinto.
          </li>
        </ul>

        <h2>Quiénes somos</h2>
        <p>
          SEYF es un producto de Seyfert Labs, un equipo mexicano. Construimos la versión actual en HackMeridian 2026,
          en Lisboa, sobre la red Stellar.
        </p>
        <p>
          ¿Quieres sumarte? Mira <Link href="/empleos">Empleos</Link>. ¿Eres medio de comunicación? Visita{" "}
          <Link href="/prensa">Prensa</Link>.
        </p>
      </article>
    </>
  );
}
