# SEYF: respuestas del envío (HackMeridian 2026)

**Categoría:** Scale · **Track:** Stellar Composed

- **App en vivo:** https://www.seyf.app/app
- **Repo:** https://github.com/Seyfert-Labs/SEYF-P (rama `meridian`)
- **Contrato:** [`CCZ77VBEZZIRBK3Z7RO4W227764G76ILXKO664R622FOSJTE7BX4CWXH`](https://stellar.expert/explorer/public/contract/CCZ77VBEZZIRBK3Z7RO4W227764G76ILXKO664R622FOSJTE7BX4CWXH) (mainnet de Stellar)
- **Evidencia contra la rúbrica:** [docs/hackmeridian-2026.md](hackmeridian-2026.md) (en inglés)

## En una línea

Ahorro que te paga hoy: guarda USDC en Stellar, gana rendimiento real de Blend a través de un vault
de DeFindex y recibe hoy parte del rendimiento de mañana, sin frase semilla y sin XLM.

## Problema

En México, la mayoría ahorra en una cuenta que casi no paga nada. El rendimiento on-chain existe,
pero pide cosas que un ahorrador común no tiene: frase semilla, XLM para comisiones, trustlines y
una extensión de wallet. Y el rendimiento llega después: quien tiene un gasto hoy tiene que romper
su ahorro.

## Solución

1. **Entras con tu correo.** Pollar crea una wallet de Stellar cosignada (Turnkey 2 de 2).
2. **Recibes USDC.** La app abre la trustline de USDC. Nuestro sponsor paga la reserva y cada
   comisión con fee-bump, así que el usuario nunca tiene XLM.
3. **Ahorras.** El USDC entra a un vault de DeFindex (Meru) que lo presta en un pool de Blend.
4. **Pides un adelanto de tu rendimiento.** Nuestro contrato Soroban `seyf_advance` bloquea las
   acciones del vault y paga, desde su propia tesorería, el rendimiento que van a generar en 1 a 30
   días. El capital nunca se toca. El usuario puede repagar antes o esperar: cuando el rendimiento
   real cubre el adelanto, un keeper llama a `settle` y el capital completo regresa.

## Cómo usa Stellar

| Pieza | Papel |
| --- | --- |
| Soroban `seyf_advance` (nuestro) | Custodia las acciones del vault, adelanta su rendimiento desde una tesorería dentro del contrato y liquida con rendimiento real |
| DeFindex + Blend | El vault de USDC y el pool de préstamos detrás |
| Pollar | Login con correo, wallet embebida cosignada, diálogo de firma |
| USDC de Circle (SAC) | El activo que se ahorra |
| SEP-10 + SEP-1 | Sesión, con la llave de firma publicada en `stellar.toml` |
| Fee-bump + CAP-33 | El usuario no paga comisiones ni necesita reserva de XLM |

## Prueba en mainnet (26 oct 2026)

Los primeros cuatro pasos se hicieron desde la app, firmados con una wallet de Pollar que tiene
0 XLM. El último es el keeper liquidando un adelanto anterior:

| Paso | Transacción |
| --- | --- |
| Trustline de USDC patrocinada | [d8d98a95…](https://stellar.expert/explorer/public/tx/d8d98a958538a4183878f65eaf0863650eec9b232db714870cceb466aca9a840) |
| Abono de 5 USDC al vault | [23572a98…](https://stellar.expert/explorer/public/tx/23572a98345f5973a144cd40422c22f815ac8d76b89e68e188cbcd8767a858d1) |
| `open_advance` | [ab42eac9…](https://stellar.expert/explorer/public/tx/ab42eac9fbd19885cbe6f7fa47a035531ff794f387fd3f5a171ce0fb4586606c) |
| `repay` | [5cfd5592…](https://stellar.expert/explorer/public/tx/5cfd5592482eac2cdb08a077df8b7e40696e1b2c24d284e1aaef98445bf4da80) |
| `settle` del keeper, cuando el rendimiento real de Blend cubrió el adelanto | [be77ba1e…](https://stellar.expert/explorer/public/tx/be77ba1e080e77d337c45b351226d535982bafb24be2fb9ef022ff58ec5e0e19) |

Todos los hashes están en [`soroban/DEPLOYMENTS.md`](../soroban/DEPLOYMENTS.md).

## Lo que se construyó en HackMeridian

Llegamos con un prototipo en EVM (MXNB en Arbitrum). Durante el evento pasamos el producto a la
mainnet de Stellar: 99 commits y 36 pull requests integrados el 25 y 26 de octubre.

- `seyf_advance` con la tesorería dentro del contrato, 17 tests y CI, desplegado en mainnet.
- Un keeper en GitHub Actions que liquida los adelantos cubiertos.
- Rutas de servidor que arman y simulan cada transacción, y un sponsor que solo paga operaciones de
  una lista permitida, con tope de `resourceFee`.
- Login con Pollar y sesión SEP-10, con una variante de prueba de cuenta para wallets cosignadas.
- Toda la `/app` sobre Pollar y mainnet, con inicio y ahorro rediseñados.

## Retos

- **Las wallets cosignadas de Pollar no pueden firmar un challenge SEP-10 estándar**
  (`/stellar/sep10/sign` les responde 502). Agregamos un challenge de prueba de cuenta: una
  transacción con secuencia 0 desde la cuenta del usuario, que nunca se puede enviar a la red y que
  el servidor verifica.
- **El usuario no tiene XLM.** Toda acción pasa por un fee-bump del servidor, así que el sponsor se
  tuvo que limitar a una lista de operaciones y contratos.
- **El rendimiento es real, así que es lento.** `settle` solo funciona cuando el rendimiento real de
  Blend cubre el adelanto, y lo probamos en mainnet con el keeper.

## Límites conocidos

- `seyf_advance` no está auditado. En mainnet corre con topes de 1 USDC por usuario y 2 USDC en
  total, una pausa que nunca bloquea `repay` ni `settle`, y sin forma de actualizarlo.
- El vault Meru es de un tercero y una sola llave puede actualizarlo.

## Lo que sigue

SCF Build Award, Integration Track: un vault de DeFindex propio, no actualizable y con multifirma,
y una ruta de auditoría para `seyf_advance`. Después, pesos de entrada y salida por SPEI con
Etherfuse (hoy en testnet) y, por último, topes más altos y lanzamiento público en México.

## Uso de IA

Parte del código, los tests y la documentación se escribieron con un asistente de código con IA
(Claude Code) y el equipo los revisó. Todas las transacciones de mainnet las firmó el equipo.
