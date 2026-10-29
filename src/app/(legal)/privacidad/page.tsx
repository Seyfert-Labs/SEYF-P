import type { Metadata } from "next";
import Link from "next/link";
import { DocHead, Mail } from "@/components/legal/DocHead";
import { LEGAL, pending } from "@/config/legal";

export const metadata: Metadata = {
  title: "Aviso de Privacidad — SEYF",
  description: "Qué datos personales trata SEYF, para qué, con quién los comparte y cómo ejercer tus derechos ARCO.",
};

const TOC: [string, string][] = [
  ["responsable", "Responsable"],
  ["datos", "Datos que tratamos"],
  ["sensibles", "Datos sensibles"],
  ["finalidades", "Para qué los usamos"],
  ["blockchain", "Datos en la red Stellar"],
  ["terceros", "Con quién los compartimos"],
  ["arco", "Tus derechos ARCO"],
  ["revocar", "Revocar tu consentimiento"],
  ["conservacion", "Cuánto tiempo los guardamos"],
  ["seguridad", "Cómo los protegemos"],
  ["almacenamiento", "Cookies y almacenamiento local"],
  ["cambios", "Cambios a este aviso"],
];

export default function Privacidad() {
  const { emails } = LEGAL;
  return (
    <>
      <DocHead
        eyebrow="Legal"
        title="Aviso de Privacidad Integral"
        lede="Qué datos personales tratamos, para qué, con quién los compartimos y cómo puedes ejercer tus derechos."
        updated
        toc={TOC}
      />
      <article className="doc-body">
        <h2 id="responsable">1. Responsable</h2>
        <p>
          <strong>{pending(LEGAL.legalName, "razón social")}</strong> (&ldquo;SEYF&rdquo;), con domicilio en{" "}
          {pending(LEGAL.address, "domicilio")}, es responsable del tratamiento de tus datos personales conforme a la
          Ley Federal de Protección de Datos Personales en Posesión de los Particulares y su normativa aplicable.
        </p>
        <p>
          Para cualquier tema de privacidad escríbenos a <Mail to={emails.privacy} />.
        </p>

        <h2 id="datos">2. Datos que tratamos</h2>
        <p>Según cómo uses SEYF, tratamos estas categorías:</p>
        <ul>
          <li>
            <strong>Para crear tu cuenta:</strong> tu correo electrónico, al que enviamos un código de acceso.
          </li>
          <li>
            <strong>Para verificar tu identidad</strong> (solo si activas funciones que la requieren): nombre(s),
            apellidos, fecha de nacimiento, CURP, RFC, teléfono, ocupación, domicilio, fotografía de tu identificación
            oficial (frente y reverso) y una selfie.
          </li>
          <li>
            <strong>Financieros y patrimoniales:</strong> la dirección pública de tu cuenta Stellar, saldos,
            movimientos, metas y bóvedas de ahorro, adelantos de rendimiento y, si las registras, cuentas bancarias
            (CLABE) para retiros.
          </li>
          <li>
            <strong>Técnicos:</strong> dirección IP, tipo de navegador y dispositivo, y registros de acceso, que usamos
            para seguridad y para prevenir abusos.
          </li>
        </ul>
        <p>No tratamos datos de menores de edad. SEYF es solo para personas mayores de 18 años.</p>

        <h2 id="sensibles">3. Datos sensibles</h2>
        <p>
          La selfie y la fotografía de tu identificación pueden considerarse datos biométricos. Solo se recaban si
          inicias la verificación de identidad, y únicamente para comprobar que eres quien dices ser. Las enviamos
          directamente a nuestro proveedor de verificación (ver sección 6); <strong>SEYF no conserva copias</strong>.
          Al enviarlas nos das tu <strong>consentimiento expreso</strong> para este tratamiento.
        </p>
        <p>
          Si usas Face ID, huella o una passkey para entrar, la biometría la procesa tu dispositivo. Ni SEYF ni sus
          proveedores reciben tu huella ni tu rostro.
        </p>

        <h2 id="finalidades">4. Para qué los usamos</h2>
        <h3>Finalidades necesarias para darte el servicio</h3>
        <ul>
          <li>Crear y administrar tu cuenta, y darte acceso seguro a ella.</li>
          <li>Crear tu cuenta en la red Stellar y operar las funciones que solicites (ahorro, adelantos, envíos).</li>
          <li>Verificar tu identidad y cumplir obligaciones de prevención de fraude y de operaciones ilícitas.</li>
          <li>Mostrarte tus saldos, movimientos y proyecciones.</li>
          <li>Atender tus solicitudes de soporte, aclaraciones y derechos ARCO.</li>
          <li>Proteger la plataforma: detectar accesos no autorizados y limitar abusos.</li>
          <li>Cumplir requerimientos de autoridades competentes.</li>
        </ul>
        <h3>Finalidades secundarias</h3>
        <p>
          Hoy <strong>no usamos tus datos para finalidades secundarias</strong> como publicidad, mercadotecnia o
          venta de bases de datos. Si algún día quisiéramos hacerlo, te lo pediremos antes y podrás negarte sin que
          afecte tu cuenta.
        </p>

        <h2 id="blockchain">5. Datos en la red Stellar</h2>
        <div className="doc-note">
          <p>
            Stellar es una red pública. Tu dirección de cuenta y tus movimientos en ella (montos, fechas y
            contrapartes) son <strong>visibles para cualquiera e inmutables</strong>: nadie, ni SEYF, puede borrarlos.
            No publicamos en la red tu nombre, correo ni ningún otro dato que te identifique directamente.
          </p>
        </div>
        <p>
          Por eso, el derecho de cancelación (sección 7) aplica a los datos que SEYF guarda en sus sistemas, pero no
          puede borrar registros de la red Stellar.
        </p>

        <h2 id="terceros">6. Con quién los compartimos</h2>
        <p>
          Trabajamos con proveedores que tratan datos por cuenta nuestra o que son necesarios para darte el servicio.
          No vendemos tus datos.
        </p>
        <div className="doc-scroll">
          <table className="doc-table">
            <thead>
              <tr><th>Proveedor</th><th>Para qué</th><th>Qué datos</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Pollar (con infraestructura de llaves de Turnkey)</td>
                <td>Inicio de sesión y wallet; firma de tus operaciones</td>
                <td>Correo, dirección Stellar, métodos de recuperación</td>
              </tr>
              <tr>
                <td>Etherfuse</td>
                <td>Verificación de identidad y, cuando esté disponible, depósitos y retiros en pesos y CETES</td>
                <td>Datos de identidad, documentos, selfie y CLABE</td>
              </tr>
              <tr>
                <td>Supabase</td>
                <td>Base de datos de la app</td>
                <td>Perfil, metas, bóvedas, cuentas bancarias registradas</td>
              </tr>
              <tr>
                <td>Vercel</td>
                <td>Hospedaje de la app y del sitio</td>
                <td>Datos técnicos y de acceso</td>
              </tr>
              <tr>
                <td>DeFindex y Blend (contratos en Stellar)</td>
                <td>Bóveda de ahorro y rendimiento</td>
                <td>Solo tu dirección Stellar y montos, en la red pública</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Algunos de estos proveedores están fuera de México. Las transferencias que hacemos son necesarias para
          cumplir la relación que tienes con nosotros, por lo que no requieren tu consentimiento adicional conforme a
          la ley. También podemos compartir datos con autoridades cuando una ley o una orden lo exija.
        </p>

        <h2 id="arco">7. Tus derechos ARCO</h2>
        <p>
          Tienes derecho a <strong>Acceder</strong> a tus datos, <strong>Rectificarlos</strong> si son inexactos,{" "}
          <strong>Cancelarlos</strong> cuando ya no sean necesarios y <strong>Oponerte</strong> a su tratamiento
          para fines específicos.
        </p>
        <p>
          Para ejercerlos escribe a <Mail to={emails.privacy} /> desde el correo de tu cuenta, con:
        </p>
        <ol>
          <li>Tu nombre y el correo con el que entras a SEYF.</li>
          <li>Una copia de tu identificación oficial (o la de tu representante y el documento que lo acredite).</li>
          <li>Qué derecho quieres ejercer y sobre qué datos, de forma clara.</li>
          <li>Cualquier documento que ayude a localizar tus datos.</li>
        </ol>
        <p>
          Te responderemos en un máximo de <strong>20 días hábiles</strong> y, si procede, haremos efectiva tu
          solicitud dentro de los <strong>15 días hábiles</strong> siguientes. Es gratuito.
        </p>
        <p>
          Algunos datos debemos conservarlos aunque pidas cancelarlos, cuando una ley nos obliga (por ejemplo, en
          materia de prevención de operaciones ilícitas), y los datos de la red Stellar no pueden borrarse (sección 5).
        </p>

        <h2 id="revocar">8. Revocar tu consentimiento y limitar el uso</h2>
        <p>
          Puedes revocar tu consentimiento o pedir que limitemos el uso de tus datos escribiendo a{" "}
          <Mail to={emails.privacy} />, con el mismo procedimiento de la sección 7. Si revocas el consentimiento para
          datos necesarios para el servicio, es posible que ya no podamos ofrecértelo; tu dinero en la red Stellar
          sigue siendo tuyo y puedes moverlo.
        </p>

        <h2 id="conservacion">9. Cuánto tiempo los guardamos</h2>
        <p>
          Mientras tengas una cuenta activa y, después, solo el tiempo que exijan las leyes aplicables o el necesario
          para atender aclaraciones. Al terminar ese plazo los eliminamos o anonimizamos.
        </p>

        <h2 id="seguridad">10. Cómo los protegemos</h2>
        <ul>
          <li>Toda comunicación con SEYF viaja cifrada (HTTPS/TLS).</li>
          <li>
            Tu llave privada nunca la conoce SEYF: vive en la infraestructura segura de Pollar y Turnkey, y firmar
            requiere tu sesión y tu dispositivo.
          </li>
          <li>Las llaves de nuestros proveedores y de nuestros servidores nunca se exponen en tu navegador.</li>
          <li>El acceso interno a datos personales está limitado a quien lo necesita para operar.</li>
        </ul>
        <p>
          Si ocurre una vulneración de seguridad que afecte de forma significativa tus derechos, te lo informaremos
          sin demora para que puedas tomar medidas.
        </p>

        <h2 id="almacenamiento">11. Cookies y almacenamiento local</h2>
        <p>
          SEYF guarda en tu navegador lo mínimo para funcionar: tu sesión, tu idioma y preferencias de la app. No usamos
          cookies de publicidad ni de rastreo de terceros. Si borras estos datos, solo tendrás que volver a iniciar
          sesión.
        </p>

        <h2 id="cambios">12. Cambios a este aviso</h2>
        <p>
          Si cambiamos este aviso publicaremos la nueva versión en esta página con su fecha, y si el cambio es
          relevante te avisaremos en la app o por correo.
        </p>
        <p>
          Si consideras que tu derecho a la protección de datos fue vulnerado, puedes acudir a la autoridad
          competente en materia de protección de datos personales. Consulta también nuestros{" "}
          <Link href="/terminos">Términos y Condiciones</Link>.
        </p>
      </article>
    </>
  );
}
