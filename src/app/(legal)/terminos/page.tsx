import type { Metadata } from "next";
import Link from "next/link";
import { DocHead, Mail } from "@/components/legal/DocHead";
import { LEGAL, pending } from "@/config/legal";

export const metadata: Metadata = {
  title: "Términos y Condiciones — SEYF",
  description: "Las reglas para usar SEYF: qué es, qué no es, los riesgos y tus derechos.",
};

const TOC: [string, string][] = [
  ["aceptacion", "Aceptación"],
  ["que-es", "Qué es SEYF y qué no es"],
  ["requisitos", "Requisitos"],
  ["cuenta", "Tu cuenta y tu wallet"],
  ["servicios", "Servicios disponibles"],
  ["adelanto", "Adelanto de rendimiento"],
  ["riesgos", "Riesgos"],
  ["comisiones", "Comisiones"],
  ["uso", "Uso permitido"],
  ["terceros", "Servicios de terceros"],
  ["responsabilidad", "Responsabilidad"],
  ["terminacion", "Suspensión y cierre"],
  ["cambios", "Cambios"],
  ["ley", "Ley aplicable"],
  ["contacto", "Contacto"],
];

export default function Terminos() {
  const { emails } = LEGAL;
  return (
    <>
      <DocHead
        eyebrow="Legal"
        title="Términos y Condiciones"
        lede="Las reglas para usar SEYF, escritas para entenderse. Léelas antes de abrir tu cuenta."
        updated
        toc={TOC}
      />
      <article className="doc-body">
        <h2 id="aceptacion">1. Aceptación</h2>
        <p>
          Estos términos son un acuerdo entre tú y <strong>{pending(LEGAL.legalName, "razón social")}</strong>{" "}
          (&ldquo;SEYF&rdquo;, &ldquo;nosotros&rdquo;), con domicilio en {pending(LEGAL.address, "domicilio")}. Al
          crear una cuenta o usar la app en <code>{LEGAL.site.replace("https://", "")}</code> aceptas estos términos y
          nuestro <Link href="/privacidad">Aviso de Privacidad</Link>. Si no estás de acuerdo, no uses SEYF.
        </p>

        <h2 id="que-es">2. Qué es SEYF y qué no es</h2>
        <p>
          SEYF es una aplicación de tecnología que te permite ahorrar y operar con activos digitales sobre la red
          pública Stellar, a través de protocolos y proveedores de terceros.
        </p>
        <div className="doc-note">
          <p>
            <strong>SEYF no es un banco ni una institución de crédito</strong>, y tampoco es una institución de
            tecnología financiera autorizada. Los saldos que ves en SEYF <strong>no son depósitos bancarios</strong> y{" "}
            <strong>no están protegidos por el IPAB</strong> ni por ningún seguro de depósitos. SEYF no te da asesoría
            de inversión: la información de la app es general y no es una recomendación personalizada.
          </p>
        </div>

        <h2 id="requisitos">3. Requisitos</h2>
        <ul>
          <li>Ser mayor de 18 años y tener capacidad legal para obligarte.</li>
          <li>Darnos información verdadera, completa y actualizada, incluida la de verificación de identidad.</li>
          <li>Usar SEYF a tu nombre y por tu cuenta, no en representación de otra persona sin autorización.</li>
          <li>No estar en listas de sanciones nacionales o internacionales.</li>
        </ul>

        <h2 id="cuenta">4. Tu cuenta y tu wallet</h2>
        <p>
          Al entrar con tu correo se crea una wallet en Stellar a tu nombre, administrada por nuestro proveedor
          Pollar. <strong>SEYF nunca tiene tu llave privada</strong> ni puede mover tu dinero sin tu firma. Esto
          significa también que:
        </p>
        <ul>
          <li>
            Eres responsable de proteger el acceso a tu correo y tus métodos de recuperación (passkey, otro
            dispositivo o correo). Configúralos: sin ellos podrías perder el acceso a tu cuenta.
          </li>
          <li>
            Las operaciones en Stellar son <strong>definitivas e irreversibles</strong>. Revisa el monto y la
            dirección antes de confirmar un envío; SEYF no puede revertir una operación ya registrada en la red.
          </li>
          <li>
            Nunca te pediremos tu código de acceso ni que firmes algo fuera de la app. Si alguien lo hace, es un
            intento de fraude: repórtalo en <Link href="/soporte">Soporte</Link>.
          </li>
        </ul>

        <h2 id="servicios">5. Servicios disponibles</h2>
        <p>Hoy, en la red principal de Stellar, SEYF ofrece:</p>
        <ul>
          <li>
            <strong>Recibir y enviar USDC</strong> en tu cuenta Stellar, sin comprar XLM para comisiones de red.
          </li>
          <li>
            <strong>Ahorro en bóveda:</strong> depósito de USDC en una bóveda de DeFindex que genera rendimiento
            prestando en el protocolo Blend.
          </li>
          <li>
            <strong>Adelanto de rendimiento</strong> sobre tu ahorro (sección 6).
          </li>
        </ul>
        <p>
          Las funciones marcadas como &ldquo;Próximamente&rdquo; en la app o en el sitio (como depósitos y retiros por
          SPEI, CETES, bonos de otros países o conversión de divisas) <strong>no están disponibles</strong> hasta que
          la app te permita usarlas, y pueden tener términos adicionales.
        </p>

        <h2 id="adelanto">6. Adelanto de rendimiento</h2>
        <p>
          El adelanto te entrega hoy, en USDC, el rendimiento estimado de tu ahorro por un plazo que eliges. Funciona
          así, mediante el contrato <code>seyf_advance</code> en Stellar:
        </p>
        <ul>
          <li>
            Tus participaciones en la bóveda quedan <strong>bloqueadas</strong> en el contrato y siguen generando
            rendimiento.
          </li>
          <li>
            Se liberan cuando su rendimiento cubre el adelanto: ese rendimiento se usa para saldarlo y recuperas tu
            capital completo. Puedes pagar antes y recuperar todas tus participaciones.
          </li>
          <li>
            El monto del adelanto se calcula con la tasa vigente y tiene un tope respecto a tu ahorro. Si el
            rendimiento real resulta menor al estimado, tus participaciones pueden tardar más en liberarse.
          </li>
          <li>SEYF no cobra comisión por el adelanto. Te mostramos el monto exacto antes de confirmar.</li>
        </ul>

        <h2 id="riesgos">7. Riesgos</h2>
        <p>Antes de usar SEYF entiende que:</p>
        <ul>
          <li>
            <strong>El rendimiento no está garantizado.</strong> Es variable, depende de los protocolos de terceros y
            puede bajar. Rendimientos pasados o proyecciones (marcadas como &ldquo;Ilustrativo&rdquo;) no aseguran
            resultados futuros.
          </li>
          <li>
            <strong>Riesgo tecnológico:</strong> los contratos inteligentes, la red Stellar y los proveedores pueden
            fallar, tener errores o ser atacados, y eso puede causar retrasos o pérdidas.
          </li>
          <li>
            <strong>Riesgo del activo:</strong> USDC es emitido por un tercero (Circle) y su valor frente al dólar o
            al peso puede variar.
          </li>
          <li>
            <strong>Riesgo cambiario:</strong> mostramos tus saldos en pesos como referencia; el valor real depende del
            tipo de cambio.
          </li>
          <li>
            <strong>Riesgo regulatorio:</strong> cambios en la ley pueden limitar o modificar los servicios.
          </li>
        </ul>
        <p>Usa solo dinero que puedas mantener ahorrado y cuya pérdida no afecte tus necesidades básicas.</p>

        <h2 id="comisiones">8. Comisiones</h2>
        <p>
          Las comisiones vigentes están en <Link href="/comisiones">Comisiones</Link>. Antes de cada operación te
          mostramos cualquier costo que aplique. No cobraremos una comisión nueva sin avisarte antes.
        </p>

        <h2 id="uso">9. Uso permitido</h2>
        <p>No puedes usar SEYF para:</p>
        <ul>
          <li>Operaciones con recursos de procedencia ilícita, fraude, financiamiento al terrorismo o evasión de sanciones.</li>
          <li>Suplantar a otra persona o dar información falsa.</li>
          <li>Intentar vulnerar, sobrecargar o hacer ingeniería inversa de la app o de sus sistemas.</li>
        </ul>
        <p>
          Si detectamos actividad sospechosa podemos pedirte información adicional, limitar funciones de la app o
          reportar a las autoridades cuando la ley lo exija.
        </p>

        <h2 id="terceros">10. Servicios de terceros</h2>
        <p>
          SEYF se apoya en Stellar, Pollar, DeFindex, Blend, Etherfuse y otros proveedores. Cada uno opera bajo sus
          propios términos, y algunas funciones requieren que los aceptes. SEYF no controla la red Stellar ni los
          protocolos de terceros.
        </p>

        <h2 id="responsabilidad">11. Responsabilidad</h2>
        <p>
          Cuidamos la app y la mejoramos continuamente, pero la ofrecemos &ldquo;tal como está&rdquo; y no podemos
          garantizar que funcione sin interrupciones. En la medida que lo permita la ley, SEYF no responde por
          pérdidas causadas por fallas de terceros o de la red, por operaciones que firmaste o por el acceso a tu
          cuenta con tus credenciales. Nada en estos términos limita los derechos que te da la ley como consumidor.
        </p>

        <h2 id="terminacion">12. Suspensión y cierre</h2>
        <p>
          Puedes dejar de usar SEYF cuando quieras. Como tu dinero está en tu cuenta Stellar, sigue siendo tuyo:
          retíralo de la bóveda y envíalo a donde prefieras. Para cerrar tu cuenta y pedir la cancelación de tus datos
          escribe a <Mail to={emails.support} />.
        </p>
        <p>
          Podemos suspender o cerrar tu acceso si incumples estos términos o si la ley lo exige. Salvo que una
          autoridad lo impida, te avisaremos y podrás retirar tu dinero.
        </p>

        <h2 id="cambios">13. Cambios</h2>
        <p>
          Si cambiamos estos términos publicaremos la nueva versión con su fecha. Si el cambio te afecta de forma
          relevante te avisaremos con al menos 15 días naturales de anticipación; si no estás de acuerdo, puedes dejar
          de usar SEYF.
        </p>

        <h2 id="ley">14. Ley aplicable</h2>
        <p>
          Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las
          partes se someten a los tribunales competentes de {pending(LEGAL.jurisdiction, "ciudad y estado")}, sin
          perjuicio de los derechos que la ley te otorgue como consumidor.
        </p>

        <h2 id="contacto">15. Contacto</h2>
        <p>
          Dudas, aclaraciones o quejas: <Mail to={emails.support} />. Más opciones en{" "}
          <Link href="/soporte">Soporte</Link>.
        </p>
      </article>
    </>
  );
}
