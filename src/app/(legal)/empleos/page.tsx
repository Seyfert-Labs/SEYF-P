import type { Metadata } from "next";
import { DocHead, Mail } from "@/components/legal/DocHead";
import { LEGAL } from "@/config/legal";

export const metadata: Metadata = {
  title: "Empleos — SEYF",
  description: "Trabaja con SEYF.",
};

export default function Empleos() {
  return (
    <>
      <DocHead
        eyebrow="Compañía"
        title="Empleos"
        lede="Hoy no tenemos vacantes abiertas, pero siempre queremos conocer a gente buena."
      />
      <article className="doc-body">
        <p>
          Si te interesa construir finanzas simples para México, mándanos tu perfil a <Mail to={LEGAL.emails.jobs} />{" "}
          con un par de líneas sobre ti y algo que hayas construido (código, diseño, producto, lo que sea). Lo leemos
          todo y te escribimos cuando abramos una vacante que te quede.
        </p>
        <h2>Lo que nos importa</h2>
        <ul>
          <li>Cuidar el dinero de las personas como si fuera el tuyo.</li>
          <li>Explicar lo complejo en palabras simples.</li>
          <li>Entregar trabajo terminado y verificado.</li>
        </ul>
      </article>
    </>
  );
}
