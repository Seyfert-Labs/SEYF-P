/**
 * Datos legales de SEYF: un solo lugar para lo que aparece en Términos, Aviso de
 * Privacidad, Soporte y el pie de página.
 *
 * ⚠️ Antes de publicar: llenar los campos `null` (los exige la LFPDPPP para el
 * aviso de privacidad) y pedir revisión de un abogado. Mientras sean `null`, las
 * páginas muestran un marcador "[Pendiente: …]" a propósito, para que no se
 * publique un documento incompleto sin que se note.
 */

export const LEGAL = {
  /** Nombre comercial. */
  brand: "SEYF",
  /** Razón social del responsable (p. ej. "Seyfert Labs, S.A.P.I. de C.V."). */
  legalName: null as string | null,
  /** RFC del responsable. */
  rfc: null as string | null,
  /** Domicilio para oír y recibir notificaciones. */
  address: null as string | null,
  /** Ciudad y estado cuyos tribunales resuelven controversias (p. ej. "Ciudad de México"). */
  jurisdiction: null as string | null,

  site: "https://www.seyf.app",
  emails: {
    support: "soporte@seyf.app",
    privacy: "privacidad@seyf.app",
    press: "prensa@seyf.app",
    investors: "inversionistas@seyf.app",
    jobs: "empleos@seyf.app",
  },
  /** Plazo de primera respuesta de soporte, en días hábiles. */
  supportResponseDays: 2,
  /** Fecha de la versión vigente de los documentos. */
  updated: "29 de octubre de 2026",
} as const;

export function pending(value: string | null, what: string): string {
  return value ?? `[Pendiente: ${what}]`;
}
