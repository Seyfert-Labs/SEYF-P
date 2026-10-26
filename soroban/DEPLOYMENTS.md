# Despliegues de `seyf_advance`

## Modelo

El contrato es un escrow: custodia las acciones del vault de DeFindex del
usuario, que siguen rindiendo, y le adelanta en USDC el rendimiento de un plazo.
El USDC sale de la **tesorería del contrato** (su propio saldo de USDC), nunca
del vault ni del capital del usuario. Cualquiera fondea con `fund_treasury`; solo
el admin retira con `withdraw_treasury`, y solo del saldo libre. Las acciones
quedan bloqueadas **hasta que su rendimiento cubre el adelanto**
(`V_now >= V_open + A`). Entonces `settle`, que cualquiera puede llamar, retira
del vault exactamente ese rendimiento hacia la tesorería y devuelve al usuario su
principal completo. El usuario puede salir antes con `repay`, también en pausa.

## Mainnet (26 de octubre de 2026): beta con topes bajos

Contrato: **`CCZ77VBEZZIRBK3Z7RO4W227764G76ILXKO664R622FOSJTE7BX4CWXH`**, con el
mismo wasm que testnet (`64ae06cb3e50eb304b2eb8b7dc2be9f9271432b04d77b0f2a9eeded899e9bdfa`).
Se comparó sección por sección con el que compiló CI (`contracts.yml`), y solo
cambian metadatos de compilación. Se usó Stellar CLI 28.1.0.

| Rol | Cuenta |
| --- | --- |
| Admin (`seyf-admin`) | `GA7OITMN2PC55EPIMQL5SWX6ZGT55HEHJEIC7FDAHCZWCPLFZZ5N6V7U` |
| Keeper (`seyf-keeper-hot`, solo paga `settle`) | `GAYVVUKEUZQ76FYKORZNQL2S3HU56VSFSBE4KTPJXCLASB3XELHXTSC3` |
| Sponsor de reservas y comisiones (`seyf-sponsor-hot`) | `GDPVVG4AWVXDS6WBS4PEBGH7UVJKFJUKC26UVBCG7LYIYIM3S6EQHB72` |
| Firma de challenges SEP-10 (`seyf-sep10-hot`, sin fondos) | `GCICR4ID7D6MSU4N7ZST3U7YCSRO6YCDOUKWAYZHHR6JD4BWKC46LQ5E` |

Las llaves se guardan de dos maneras distintas y ninguna está en el repo:

- **Admin:** en el almacén seguro del sistema operativo (`stellar keys
  generate --secure-store`). No se puede exportar y nunca va a un servidor.
- **Keeper, sponsor y SEP-10:** son llaves *calientes* que viven en GitHub
  Actions o en Vercel, así que tienen que poder exportarse. Por eso llevan el
  saldo mínimo.

Primero el keeper y el sponsor se crearon en el almacén seguro: `GCMD53GF…` y
`GCEXGM4C…`. No se podían exportar, así que se fusionaron de vuelta al admin. Hay cuentas *look-alike* que imitan
estas direcciones (mismo inicio y mismo final) y que mandaron transacciones de
polvo para envenenar el historial. **Nunca copies una dirección desde el historial
de transacciones**: usa solo esta tabla.

- **Vault:** Meru, DeFindex USDC, `CCA2ZJP5BVRXYTQH4FAGHCAUMRYCXVC4CRYC2NXHWMR7TIVX36U7F5HR`.
  Su estrategia activa es "USDC Autocompound Blend Fixed" (`CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP`),
  sobre el pool Blend Fixed `CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD`.
- **Activo:** USDC de Circle (`GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`),
  SAC `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`.
- **Parámetros:** `apy_bps` 50, `max_advance_bps` 500, plazo de 1 a 30 días,
  tope de 1 USDC por usuario y 2 USDC en total, lista de usuarios activa.
  - `apy_bps` queda muy por debajo del ~5 % neto medido en Meru. Así el
    rendimiento real cubre el adelanto mucho antes de que termine el plazo.

### Ciclo en mainnet

| Paso | Resultado | Transacción | Comisión (XLM) |
| --- | --- | --- | --- |
| Trustline de USDC del admin | — | [0b29c9f6…](https://stellar.expert/explorer/public/tx/0b29c9f68a3b72c29f0a8aa52ca44e4c69ed550c1d8c24ad4eccf5179f781329) | 0.00001 |
| Crear la cuenta del keeper (2 XLM) | — | [a34ebafb…](https://stellar.expert/explorer/public/tx/a34ebafbae0a4dcb6da98a1bc7d72b3168644132cc0deeed3910c1a7bdf929a6) | 0.00001 |
| Crear la cuenta del sponsor (6 XLM) | — | [267ce58c…](https://stellar.expert/explorer/public/tx/267ce58c4c83910749b378c41bd3428b707452b6e82e7ec0b183fe6cfdf5d959) | 0.00001 |
| Fusionar keeper y sponsor viejos con el admin | — | [e9b5f7c3…](https://stellar.expert/explorer/public/tx/e9b5f7c3c01253ca8dc1b51b24acdb37939588aabf70606c3a20d6070e99d52a), [313672cf…](https://stellar.expert/explorer/public/tx/313672cf3d8c71e731182056813d3509e14af246445ef1e3d16c1ed5a6e0936a) | 0.00001 c/u |
| Subir el wasm | — | [0170a085…](https://stellar.expert/explorer/public/tx/0170a085269d803862140bfe99616ee09d49f2d4e653dc69d4e5b07711b59655) | 22.36 |
| Desplegar con constructor | lectura verificada de admin, vault, activo y parámetros | [1fa79ed9…](https://stellar.expert/explorer/public/tx/1fa79ed90c90bf71063be5fbbdcc5fd30ea398d47d8dee7e3a12ff34cd6e540c) | 0.11 |
| `fund_treasury` (2 USDC) | `treasury()` = 20 000 000 | [633b79df…](https://stellar.expert/explorer/public/tx/633b79df5073010cdc92a1a37766f92602f52169bda0ea2e69916bcf4ea40c8c) | 0.038 |
| `set_allowed(admin, true)` | — | [776a7fbf…](https://stellar.expert/explorer/public/tx/776a7fbffd08298051c582ad87c484b9f7b7020b35ab9deb71af1a08ef1c1241) | 0.023 |
| Depósito en Meru (5 USDC) | 46 064 942 acciones; el vault invierte en Blend (evento `supply` del pool) | [fa4cc2eb…](https://stellar.expert/explorer/public/tx/fa4cc2eb5d4f5c0c2198a2ee3d53e8ebc9dc7860381d4523b9bce307d06961bb) | 0.028 |
| Retiro de Meru (9 213 000 acciones) | 1.0000014 USDC. Salió del pool de Blend porque el vault no tenía saldo ocioso | [082bee22…](https://stellar.expert/explorer/public/tx/082bee220cdde1d072b6d7d8792a6e4d1b53ae152433ac31bd7e225824ec45de) | 0.0027 |
| `open_advance` a 1 día (36 851 942 acciones) | `V_open` = 39 999 998; adelanto de 547 desde la tesorería; `treasury()` = 19 999 453 | [de3d6629…](https://stellar.expert/explorer/public/tx/de3d6629638af6aea2e96784bfb135073c7b60022d3de47d2e990b0b8e7720dc) | 0.081 |
| `settle` por el keeper (GitHub Actions, `seyf-keeper-hot`), 2026-10-26 04:22 UTC | el rendimiento real de Blend llevó `V` a 40 000 626 (≥ 40 000 545); posición cerrada y `treasury()` = 20 000 000 (19 999 453 + 547) | [be77ba1e…](https://stellar.expert/explorer/public/tx/be77ba1e080e77d337c45b351226d535982bafb24be2fb9ef022ff58ec5e0e19) | 0.0033 |

Subir el wasm costó 22.36 XLM, que es casi todo el costo. Cada operación del
contrato cuesta de 0.02 a 0.11 XLM. La CLI necesita `--inclusion-fee 10000`
cuando la tarifa de inclusión de Soroban sube (estaba en 200 stroops).

### Keeper

Se ejecuta con `.github/workflows/keeper.yml` cada 10 minutos desde `meridian`.

- Variables del repo:
  - `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`
  - `NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT=CCZ77VBE…`
  - `KEEPER_START_LEDGER=65138547`, el ledger del primer `open_advance`.
- Secreto: `KEEPER_SECRET`.

La primera corrida en dry-run encontró el adelanto y respondió `YieldNotCovered`,
lo que es correcto mientras el rendimiento no lo cubra.
Cuando el rendimiento cubrió el adelanto, una corrida manual (`dry_run=false`,
[run 40268641108](https://github.com/Seyfert-Labs/SEYF-P/actions/runs/40268641108))
liquidó la posición con `settle` (hash arriba). El cron programado no se había
disparado solo; el despacho manual es el respaldo.

### Riesgos del vault elegido

Ver la sección **Riesgos de la beta en mainnet** del [README](../README.md#riesgos-de-la-beta-en-mainnet).

## Testnet (25 de octubre de 2026): tesorería dentro del contrato

Vault: DeFindex USDC de testnet `CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN`
(estrategia "USDC Blend Strategy"). Activo: USDC de Blend testnet, SAC
`CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU`.

Contrato vigente: **`CASAU3YCJQYXAVKNUTSHTH5F2DJVES7BM3QOVN4RD2NVAVLD2DRUM7ZI`**
(wasm `64ae06cb3e50eb304b2eb8b7dc2be9f9271432b04d77b0f2a9eeded899e9bdfa`, Stellar
CLI 28.1.0). Admin: `seyf-tn-admin` (`GDCSGJSN7KOXKX3FNH7A6IFHPMHZOOTRIKTS2YQ2XKJW3L3UT46H3C4R`).
Parámetros: `apy_bps` 800, `max_advance_bps` 500, plazo 1–365 días, tope 10 USDC
por usuario y 100 USDC en total, lista de usuarios activa.

### Ciclo verificado contra el vault real

Usuario: `seyf-tn-user2` (`GAENUW4LPKMBV7O3B35VZNA4L3IUCMSTG75NSMTL4GIU22HQQWRRT6UN`),
con 199 912 350 acciones del vault.

| Paso | Resultado | Transacción |
| --- | --- | --- |
| Subir wasm | — | [7f13a341…](https://stellar.expert/explorer/testnet/tx/7f13a341c9b495b6c1ed431170012447699908b008b6d67f43513a9cb0cd8b41) |
| Desplegar con constructor | costó ~5.6 XLM en total con la subida | [50316422…](https://stellar.expert/explorer/testnet/tx/50316422da7f0a675b74196f5dfc99cdd150e9bccb35b27afe95586636d60a2f) |
| `set_allowed(user2, true)` | — | [883f9f8a…](https://stellar.expert/explorer/testnet/tx/883f9f8a10f42f5ec2fc06c3e340792d21bcc6a2b3f44cc8f5b98911ec02b2c5) |
| `fund_treasury` (admin, 10 USDC) | `treasury()` = 100 000 000 | [0d24aaf9…](https://stellar.expert/explorer/testnet/tx/0d24aaf957cb8ebaffa061e6ce38ceceb6d82536d18229c2d2d3138dbd5c2e79) |
| `open_advance` a 30 días | adelanto 1 314 839 (0.1314839 USDC) desde la tesorería; `treasury()` = 98 685 161 | [439919ce…](https://stellar.expert/explorer/testnet/tx/439919ce77d2df224e495faebc2709a677278442bafd4a2c415237d15a2e5158) |
| `pause` | — | [7b9a80da…](https://stellar.expert/explorer/testnet/tx/7b9a80da7652864c4b5092554aae93008d9d1c06fb95a82aaa231f20404e1123) |
| `repay` **en pausa** | devuelve todas las acciones; `treasury()` = 100 000 000, `outstanding` = 0 | [4fc864b4…](https://stellar.expert/explorer/testnet/tx/4fc864b4d80ecdb7594959e95e7382424809c1a8472ad08696703a4eda5c0c78) |
| `unpause` | — | [5571ab7f…](https://stellar.expert/explorer/testnet/tx/5571ab7fcadee43b75e19be3900841f2d07ac0f964594f9637c49478073b352c) |
| `open_advance` a 1 día | adelanto 43 827; `unlock_status` = (199 965 185, 200 009 012) | [90672238…](https://stellar.expert/explorer/testnet/tx/906722388db120f6171785c936ff9eb69a6c83d4f9789d4a8e461188e147d763) |
| `settle` sin rendimiento | rechazado con `YieldNotCovered` (#5) | simulación |
| Rendimiento simulado: 0.4 USDC donados al vault | valor de la posición 199 985 207 (aún no cubre) | [f9d735c4…](https://stellar.expert/explorer/testnet/tx/f9d735c47fef6b8bdeda89c7b87be2d8704a33c69da1685a41fb7dda5e11252a) |
| Rendimiento simulado: 0.6 USDC más | valor de la posición 200 015 240 ≥ 200 009 012 | [bec8c170…](https://stellar.expert/explorer/testnet/tx/bec8c170d2d4d92955c0311a327d267cc6af5ed7c4fbef81ef31d4a202ac5a32) |
| `settle` (firmado por `seyf-tn-user1`, un tercero) | retira 43 805 acciones = 43 827 a la tesorería (exactamente A); devuelve 199 868 545 acciones, que valen 199 971 412 (más que el principal de 199 965 185); `treasury()` = 100 000 000 | [fde0b2c9…](https://stellar.expert/explorer/testnet/tx/fde0b2c9503541437f276b1153c625b95d873d981327a7ac61ae2ac39828763f) |
| `withdraw_treasury` de 10.0000001 USDC | rechazado con `InsufficientTreasury` (#11) | simulación |
| `withdraw_treasury` (admin, 1 USDC) | evento `TreasuryWithdrawn`; `treasury()` = 90 000 000 | [4a035f32…](https://stellar.expert/explorer/testnet/tx/4a035f32cf05594b8e490e4d9680ff08135be6ed02ec1a71729fabdb40c2739e) |

Al cerrar: `outstanding` = 0, sin posiciones, el contrato sin acciones del vault
y 9 USDC en la tesorería.

### Límites de esta prueba

- El vault de testnet tiene todo el saldo ocioso (`invested_amount` = 0), así que
  no genera rendimiento y `withdraw` no tuvo que sacar fondos de Blend. El
  rendimiento se simuló donando USDC al vault (sube el valor de todas sus
  acciones). El rendimiento real y el retiro desde Blend se validan en mainnet.
- Las comisiones en testnet no son representativas: su estado vivo de Soroban
  (4.07 GB) rebasa el objetivo de la red (4.0 GB) y la renta se dispara (un
  despliegue anterior costó ~5 000 XLM; el de este contrato, ~5.6 XLM). Mainnet está en
  1.67 GB de 3.0 GB, con los mismos parámetros de comisión.

### Versiones anteriores (reemplazadas)

Modelo con cuenta de liquidez aparte (allowance de USDC hacia el contrato):
`CDG5V5GRD7KYJBREQXRVDEUSJCGCUZSI3EXD5ZHF2WDM7WKZLU5I75XB`, liquidez
`GDCSGJSN7KOXKX3FNH7A6IFHPMHZOOTRIKTS2YQ2XKJW3L3UT46H3C4R`. Ahí se verificaron
`open_advance` → `settle` ([d60985c8…](https://stellar.expert/explorer/testnet/tx/d60985c8407fe4127f0fc6031776b4c243824fe946320008c0bf7a9f9bb5c37a))
y `open_advance` → `repay` ([7ddd35ec…](https://stellar.expert/explorer/testnet/tx/7ddd35eca428f83bc94d49a4a93fcad5ea98eb1d8289f2085c5d81da45c27b02)).

Primer modelo, con desbloqueo por fecha y tesorería dentro del contrato:
`CCLC3HRPL2GYXTGOFFNKITQGPYLZXQG4TO7OV6M533PGXZ3ZQBOGEGTZ` (normal) y
`CABH4NNGEVFHEJLASJRSULT3YYRK3FYPZDZKTMZMSWPF3JEYQWYALS2Q` (día = 60 s). En el
segundo se verificó `open_advance` → `settle` → `repay` contra el mismo vault
([settle 04962da3…](https://stellar.expert/explorer/testnet/tx/04962da3371adfe529e265e5c5ea9f8f3ff8ab9c109cb62b53a8de46363282ae)).
En el primero queda abierta una posición de prueba de `seyf-tn-user1` que vence
el 26 de octubre a las 13:52 UTC.
