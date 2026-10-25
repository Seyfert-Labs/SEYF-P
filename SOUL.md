# SOUL — SEYF

Quién es SEYF, para quién existe y cómo se trabaja aquí. Se lee antes que el
código; si una decisión técnica contradice esto, gana esto.

## Qué es

SEYF es la app de ahorro e inversión para México construida **completamente
sobre Stellar**: pesos que entran por SPEI, se vuelven CETES tokenizados o
dólares digitales, rinden en bóvedas on-chain y salen al banco cuando el usuario
quiera. Sin seed phrase, sin comprar XLM para comisiones, sin jerga cripto.

## Para quién

Una persona en México que ahorra en el banco al 0% o en la Afore sin verla.
No sabe —ni tiene por qué saber— qué es una trustline. Mide todo en pesos.

## Principios (en orden de prioridad)

1. **El dinero del usuario primero.** Ninguna prisa justifica firmar algo sin
   simular, sin `destMin` del servidor, o contra un contrato no verificado.
2. **La verdad sobre Stellar viene de una fuente, no de la memoria.** Direcciones
   (`G…`, `C…`), versiones, APIs y SEPs se confirman con **stellar-raven** o
   las docs oficiales. Si no se confirma, va en env y se marca como pendiente.
3. **Honestidad on-chain.** Lo que está en mainnet se prueba con un hash. Lo que
   está en testnet se dice. Nunca se presenta un mock como producto.
4. **Apalancarse antes que construir.** Primero se busca lo que ya existe y es
   seguro en el ecosistema (ver `docs/seyf-context.md` §Check 4); se escribe
   código propio solo para lo que nos hace distintos.
5. **Full Stellar.** Un solo riel. Nada de EVM, nada de puentes "por si acaso".
6. **Simple por fuera.** UI en español de México, montos en MXN, cero
   tecnicismos en pantalla. Nunca "banco" ni "neobank" en el producto público
   (Ley Fintech).
7. **Secretos en el servidor.** Nunca bajo `NEXT_PUBLIC_*`, nunca en el repo.

## Cómo trabaja el agente aquí

- Antes de construir: corre los **4 checks** de `docs/seyf-context.md`.
- Rama de trabajo: `meridian`. `main` no se toca sin que lo pidan.
- Cada bloque cierra con `npm run build` en verde. Si algo no cabe, se oculta
  tras flag; nunca se deja roto.
- Commits pequeños, en español, estilo `feat(...)` / `fix(...)` / `chore(...)`.
- Se reporta lo que pasó, incluidos los fallos. "Hecho" significa verificado.
