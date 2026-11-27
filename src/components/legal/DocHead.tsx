import { LEGAL } from "@/config/legal";

/** Encabezado de una página institucional, con índice opcional de secciones. */
export function DocHead({
  title,
  lede,
  updated = false,
  toc,
}: {
  /** ya no se muestra; se conserva para no tocar cada página */
  eyebrow?: string;
  title: string;
  lede?: string;
  updated?: boolean;
  toc?: [id: string, label: string][];
}) {
  return (
    <>
      <div className="doc-head">
        <h1>{title}</h1>
        {lede && <p className="doc-lede">{lede}</p>}
        {updated && <p className="doc-updated">Última actualización: {LEGAL.updated}</p>}
      </div>
      {toc && (
        <nav className="doc-toc" aria-label="Contenido">
          <p>Contenido</p>
          <ol>
            {toc.map(([id, label]) => (
              <li key={id}><a href={`#${id}`}>{label}</a></li>
            ))}
          </ol>
        </nav>
      )}
    </>
  );
}

/** Enlace mailto con el correo visible. */
export function Mail({ to }: { to: string }) {
  return <a href={`mailto:${to}`}>{to}</a>;
}
