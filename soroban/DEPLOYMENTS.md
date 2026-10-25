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
