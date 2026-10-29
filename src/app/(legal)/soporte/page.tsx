import type { Metadata } from "next";
import Link from "next/link";
import { DocHead, Mail } from "@/components/legal/DocHead";
import { LEGAL } from "@/config/legal";

export const metadata: Metadata = {
  title: "Soporte — SEYF",
  description: "Cómo contactar a SEYF, recuperar tu cuenta, reportar un fraude o presentar una queja.",
};

export default function Soporte() {
  const { emails, supportResponseDays } = LEGAL;
  return (
    <>
      <DocHead
        eyebrow="Ayuda"
        title="Soporte"
        lede="Personas reales del equipo de SEYF leen cada mensaje."
      />
      <article className="doc-body">
        <div className="doc-cards">
          <div className="doc-card">
            <h3>Ayuda con tu cuenta</h3>
            <p><Mail to={emails.support} /></p>
            <p>Primera respuesta en máximo {supportResponseDays} días hábiles.</p>
          </div>
          <div className="doc-card">
            <h3>Privacidad y datos</h3>
            <p><Mail to={emails.privacy} /></p>
            <p>Derechos ARCO y revocación de consentimiento.</p>
          </div>
        </div>
        <p>
          Escríbenos desde el correo con el que entras a SEYF e incluye, si aplica, la fecha, el monto y una captura de
          pantalla. <strong>Nunca nos mandes tu código de acceso</strong>: no lo necesitamos para ayudarte.
        </p>

        <h2>Antes de escribirnos</h2>
        <h3>No puedo entrar a mi cuenta</h3>
        <p>
          Entra con tu correo y el código que te enviamos. Si cambiaste de dispositivo o navegador, la app te pedirá
          confirmarlo con el método de recuperación que configuraste (passkey, otro dispositivo o correo). Si no
          configuraste ninguno, escríbenos.
        </p>
        <h3>Envié dinero a una dirección equivocada</h3>
        <p>
          Las operaciones en Stellar son irreversibles y SEYF no puede revertirlas. Si conoces a quien la recibió,
          pídele que te la devuelva. Escríbenos y te ayudamos a revisar la operación en la red.
        </p>
        <h3>Mi saldo no coincide</h3>
        <p>
          La app actualiza tu saldo con la red Stellar. Espera unos minutos y vuelve a abrirla; si sigue sin
          coincidir, escríbenos con la fecha y el monto.
        </p>

        <h2>Reportar un fraude o suplantación</h2>
        <p>
          SEYF nunca te pedirá tu código de acceso, que firmes algo fuera de la app ni que envíes dinero a una
          dirección para &ldquo;verificar&rdquo; tu cuenta. Si recibes un mensaje así, no respondas y repórtalo a{" "}
          <Mail to={emails.support} /> con el asunto <strong>Fraude</strong>.
        </p>
        <p>
          Las únicas cuentas Stellar que controla SEYF están publicadas en nuestro{" "}
          <a href="/.well-known/stellar.toml">stellar.toml</a>. Desconfía de direcciones parecidas.
        </p>

        <h2>Aclaraciones y quejas</h2>
        <p>
          Si no estás de acuerdo con una operación o con nuestro servicio, escribe a <Mail to={emails.support} /> con
          el asunto <strong>Aclaración</strong>, explicando qué pasó. Te daremos un número de folio al recibirla y una
          respuesta por escrito en máximo 15 días hábiles.
        </p>

        <h2>Reportar una vulnerabilidad</h2>
        <p>
          Si encontraste un problema de seguridad, escríbenos a <Mail to={emails.support} /> con el asunto{" "}
          <strong>Seguridad</strong> y los pasos para reproducirlo. No accedas a datos de otras personas ni hagas
          pública la falla antes de que la corrijamos; te responderemos y te daremos crédito si quieres.
        </p>

        <p>
          Consulta también los <Link href="/terminos">Términos</Link>, el{" "}
          <Link href="/privacidad">Aviso de Privacidad</Link> y las <Link href="/comisiones">Comisiones</Link>.
        </p>
      </article>
    </>
  );
}
