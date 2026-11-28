// Guiones de interacción para cada clip (selectores de la app real).
export const FLOWS = {
  // ahorro en bóveda USDC (mainnet): la app arma "Ahorro para el retiro" con la posición on-chain; abonarle
  boveda: { vaults: "none", steps: [
    { wait: 1500, mark: "home" },
    { tab: 2, wait: 2800, mark: "ahorro" },
    { click: "Ahorro para el retiro", exact: true, wait: 2400, mark: "detalle" },
    { click: "Abonar", exact: true, wait: 1100, mark: "modal" },
    { type: "1000", wait: 800 },
    { sel: ".modal-sheet .btn-primary", wait: 3000, mark: "ok" },
    { click: "Listo", wait: 2600, mark: "listo" },
  ] },
  // abonar a una bóveda existente en USDC (la del viaje) y ver cómo rinde
  abonar: [
    { tab: 2, wait: 1800, mark: "ahorro" },
    { click: "Viaje a Japón", wait: 2600, mark: "detalle" },
    { click: "Abonar", exact: true, wait: 1200, mark: "modal" },
    { type: "500", wait: 900 },
    { sel: ".modal-sheet .btn-primary", wait: 2800, mark: "ok" },
    { click: "Listo", wait: 2500, mark: "listo" },
  ],
  // adelanto: ver la cotización cambiar con el plazo y pedirlo
  adelanto: [
    { tab: 3, wait: 2000, mark: "adelanto" },
    { scroll: 620, ms: 1100, wait: 900 },
    { click: "15 días", wait: 1100, mark: "p15" },
    { range: ["input[type=range]", 30, 2200], wait: 1500, mark: "p30" },
    { scroll: 360, ms: 800, wait: 600 },
    { click: "Pedir adelanto", wait: 3500, mark: "pedido" },
  ],
  // bonos en la wallet: CETES, TESOURO (Brasil) y USTRY (EE. UU.)
  wallet: [
    { wait: 1800, mark: "home" },
    { scroll: 820, ms: 1400, wait: 1800, mark: "lista" },
    { click: "TESOURO", exact: true, wait: 2600, mark: "tesouro" },
  ],
};
