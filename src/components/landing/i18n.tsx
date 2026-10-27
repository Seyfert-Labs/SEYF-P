"use client";

/* SEYF — textos de la landing en español de México, inglés y portugués de Brasil.
   El idioma se elige en el nav; se recuerda en localStorage y, la primera vez,
   se toma del navegador. El servidor siempre pinta español (sin desfase de hidratación). */
import React, { createContext, useContext, useEffect, useState } from "react";

export type Lang = "es" | "en" | "pt";
export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: "es", label: "ES", name: "Español" },
  { id: "en", label: "EN", name: "English" },
  { id: "pt", label: "PT", name: "Português" },
];

const es = {
  nav: { product: "Producto", bonds: "Bonos", security: "Seguridad", login: "Iniciar sesión", start: "Iniciar", lang: "Idioma" },
  store: { appSub: "Descarga en", playSub: "Disponible en" },
  hero: {
    words: ["Tu", "dinero,", "protegido", "y", "creciendo", "en", "automático."],
    lede: "Tus pesos generan rendimiento todos los días. Sin comisiones.",
    cta: "Iniciar ahora",
    how: "Ver cómo funciona",
    yieldL: "Rinde",
    yieldR: "diario",
    yieldSub: "Se calcula y se paga todos los días, sobre tus pesos. Sin plazos forzosos.",
    earnedToday: "Ganado hoy",
    withdrawK: "Retiros por SPEI",
    withdrawV: "24/7",
    simple: ["Sin seed phrase.", "Sin comisiones.", "Sin letras chiquitas."],
    simpleSub: "Construido sobre Stellar: tu dinero se mueve en segundos y siempre es tuyo.",
    scroll: "Desliza",
  },
  marqueeFx: "Tipo de cambio real · 0% comisión",
  manifestoTag: "Por qué SEYF",
  manifesto:
    "Tu dinero parado pierde contra la inflación todos los días. SEYF pone a trabajar cada peso: rinde diario, se mueve en segundos y sale cuando tú decides. Sin trucos ni sorpresas.",
  story: {
    tag: "Así funciona",
    title: "Tres pasos. Así de fácil.",
    steps: [
      { ti: "Deposita por SPEI", de: "Recibe tu CLABE al instante. Cada peso que entra empieza a rendir desde el primer día." },
      { ti: "Convierte sin margen", de: "Pásate a dólar digital al tipo de cambio real, en segundos y sin comisiones escondidas." },
      { ti: "Ahorra con metas", de: "Crea bóvedas para tus metas, ve cómo crecen y retira a tu banco cuando quieras." },
    ],
    chips: [
      [{ k: "SPEI recibido", v: "+$5,000.00" }, { k: "Tu CLABE", v: "646 180 1234 5678 90" }],
      [{ k: "Tipo de cambio", v: "1 USD = 17.40" }, { k: "Comisión", v: "$0.00" }],
      [{ k: "Viaje a Japón", v: "64% de la meta" }, { k: "Rendimiento", v: "Diario" }],
    ],
  },
  stats: ["mínimo para invertir en bonos", "depósitos y retiros por SPEI", "para mover tu dinero en Stellar", "comisión por cambio de divisa"],
  bonds: {
    tag: "Bonos de gobierno",
    title: "Rendimientos soberanos, en un toque.",
    sub: "Invierte en deuda respaldada por gobiernos desde $50. Tu dinero disponible en 1 día hábil y en custodia regulada.",
    annual: "anual",
    from: "Desde $50",
    liquidity: "Retiro en 1 día hábil",
    countries: { mx: "México", us: "Estados Unidos", br: "Brasil", ar: "Argentina", co: "Colombia", eu: "Europa", kr: "Corea del Sur" },
    capitals: { mx: "CDMX", us: "Washington", br: "Brasilia", ar: "Buenos Aires", co: "Bogotá", eu: "Bruselas", kr: "Seúl" },
    short: { us: "EE. UU.", kr: "Corea" },
  },
  partners: {
    tag: "Construido con",
    title: "La mejor infraestructura de Stellar.",
    sub: "Cada pieza de SEYF corre sobre protocolos abiertos y auditables del ecosistema.",
    roles: ["Red de pagos · liquidación en ~5 s", "Bóvedas de rendimiento on-chain", "Wallet sin seed phrase", "CETES tokenizados · SPEI"],
  },
  live: {
    tag: "En vivo en Stellar",
    title: "El adelanto ya corre en mainnet.",
    sub: "Cifras leídas del contrato seyf_advance, sin contar la cuenta administradora del contrato. Es una beta con topes bajos mientras se audita.",
    stats: ["adelantos de rendimiento abiertos", "cuentas que pidieron un adelanto", "USDC de ahorro bloqueados como respaldo"],
    asOf: "Datos al",
    verify: "Verificar en stellar.expert",
  },
  security: {
    tag: "Seguridad primero",
    title: "Tu dinero, blindado en cada capa.",
    sub: "Construido con estándares institucionales y con la transparencia de una red pública que nadie más te da.",
    layers: [
      { ti: "Verificable en Stellar", de: "Cada movimiento queda registrado en una red pública: lo puedes comprobar tú mismo cuando quieras." },
      { ti: "Cifrado AES‑256", de: "Cada dato y movimiento viaja cifrado de extremo a extremo." },
      { ti: "Acceso biométrico", de: "Face ID, NIP y verificación en dos pasos para que solo tú entres a tu dinero." },
    ],
  },
  faq: {
    tag: "Preguntas",
    title: "Lo que quieres saber.",
    items: [
      { q: "¿Cómo gana rendimiento mi saldo en pesos?", a: "Tu saldo genera rendimiento que se calcula y se paga todos los días. La tasa cambia con el mercado y siempre la ves en la app antes de mover tu dinero. No hay plazos forzosos: usas o retiras tu dinero cuando quieras." },
      { q: "¿Los bonos de gobierno tienen riesgo?", a: "La deuda soberana es de los instrumentos más seguros que existen. Cada bono muestra su calificación, riesgo y plazo antes de invertir, para que decidas con total transparencia." },
      { q: "¿De verdad el tipo de cambio es igual al de Google?", a: "Sí. Usamos el tipo de cambio interbancario real, el mismo que aparece en Google, sin agregar márgenes ni comisiones escondidas por la conversión." },
      { q: "¿Está protegido mi dinero?", a: "Tu cuenta está protegida con acceso biométrico y verificación en dos pasos, y tus datos viajan cifrados. Además, cada movimiento queda registrado en la red Stellar, donde lo puedes verificar." },
    ],
  },
  final: {
    title: "Empieza a hacer crecer tu dinero hoy.",
    sub: "Abre tu cuenta en minutos. Sin comisión por apertura y sin saldo mínimo.",
  },
  footer: {
    tagline: "La super app de finanzas para ahorrar, invertir y gastar sin fronteras.",
    product: "Producto", digitalPesos: "Pesos digitales", bonds: "Bonos", vaults: "Bóvedas",
    company: "Compañía", about: "Nosotros", security: "Seguridad", jobs: "Empleos", press: "Prensa",
    legal: "Legal", terms: "Términos", privacy: "Privacidad", fees: "Comisiones", support: "Soporte",
    investors: "Inversionistas", investorContact: "Contacto para inversionistas",
    rights: "© 2026 SEYF. Todos los derechos reservados.",
    made: "Construido sobre Stellar · Hecho en México",
  },
  mock: {
    tabs: { inicio: "Inicio", ahorro: "Ahorro", tarjeta: "Tarjeta" },
    greet: "Buenas tardes",
    toastTi: "Depósito SPEI recibido",
    toastSu: "Ya está generando rendimiento",
    total: "Patrimonio total",
    available: "Disponible",
    inVault: "En bóveda",
    quick: ["Agregar", "Enviar", "Adelanto", "Más"],
    recent: "Movimientos recientes",
    deposit: "Depósito SPEI",
    today: "Hoy",
    yesterday: "Ayer",
    dailyYield: "Rendimiento diario",
    coffee: "Cafetería La Roma",
    card: "Tarjeta",
    convert: "Convertir",
    pay: "Pagas",
    receive: "Recibes",
    availableAmt: "Disponible: $125,400.00",
    usdcHint: "Dólar digital · 1:1 con USD",
    rate: "Tipo de cambio",
    fee: "Comisión",
    arrives: "Llega en",
    seconds: "~5 segundos",
    done: "Listo",
    convertCta: "Convertir 1,000 MXN",
    savings: "Ahorro",
    inVaults: "En tus bóvedas",
    dailyChip: "rinde diario",
    earnedMonth: "+$4,028 ganados este mes",
    goals: "Mis metas",
    of: "de",
    vaults: ["Viaje a Japón", "Fondo de emergencia", "Enganche de la casa"],
    perMonth: "/mes",
  },
};

export type Dict = typeof es;

const en: Dict = {
  nav: { product: "Product", bonds: "Bonds", security: "Security", login: "Log in", start: "Get started", lang: "Language" },
  store: { appSub: "Download on the", playSub: "Get it on" },
  hero: {
    words: ["Your", "money,", "protected", "and", "growing", "on", "autopilot."],
    lede: "Your pesos earn yield every single day. No fees.",
    cta: "Get started",
    how: "See how it works",
    yieldL: "Earn",
    yieldR: "daily",
    yieldSub: "Calculated and paid every day on your pesos. No lock-up periods.",
    earnedToday: "Earned today",
    withdrawK: "SPEI withdrawals",
    withdrawV: "24/7",
    simple: ["No seed phrase.", "No fees.", "No fine print."],
    simpleSub: "Built on Stellar: your money moves in seconds and is always yours.",
    scroll: "Scroll",
  },
  marqueeFx: "Real exchange rate · 0% fees",
  manifestoTag: "Why SEYF",
  manifesto:
    "Idle money loses to inflation every single day. SEYF puts every peso to work: it earns daily, moves in seconds and comes out whenever you decide. No tricks, no surprises.",
  story: {
    tag: "How it works",
    title: "Three steps. That easy.",
    steps: [
      { ti: "Deposit via SPEI", de: "Get your CLABE instantly. Every peso you add starts earning from day one." },
      { ti: "Convert with no markup", de: "Switch to digital dollars at the real exchange rate, in seconds and with no hidden fees." },
      { ti: "Save toward goals", de: "Create vaults for your goals, watch them grow and withdraw to your bank anytime." },
    ],
    chips: [
      [{ k: "SPEI received", v: "+$5,000.00" }, { k: "Your CLABE", v: "646 180 1234 5678 90" }],
      [{ k: "Exchange rate", v: "1 USD = 17.40" }, { k: "Fee", v: "$0.00" }],
      [{ k: "Trip to Japan", v: "64% of goal" }, { k: "Yield", v: "Daily" }],
    ],
  },
  stats: ["minimum to invest in bonds", "SPEI deposits and withdrawals", "to move your money on Stellar", "currency exchange fee"],
  bonds: {
    tag: "Government bonds",
    title: "Sovereign yields, in one tap.",
    sub: "Invest in government-backed debt from $50. Your money available in 1 business day, held in regulated custody.",
    annual: "per year",
    from: "From $50",
    liquidity: "Withdraw in 1 business day",
    countries: { mx: "Mexico", us: "United States", br: "Brazil", ar: "Argentina", co: "Colombia", eu: "Europe", kr: "South Korea" },
    capitals: { mx: "Mexico City", us: "Washington", br: "Brasília", ar: "Buenos Aires", co: "Bogotá", eu: "Brussels", kr: "Seoul" },
    short: { us: "U.S.", kr: "Korea" },
  },
  partners: {
    tag: "Built with",
    title: "The best infrastructure on Stellar.",
    sub: "Every piece of SEYF runs on open, auditable protocols from the ecosystem.",
    roles: ["Payments network · ~5 s settlement", "On-chain yield vaults", "Wallet with no seed phrase", "Tokenized CETES · SPEI"],
  },
  live: {
    tag: "Live on Stellar",
    title: "The advance is already live on mainnet.",
    sub: "Figures read from the seyf_advance contract, excluding the contract's admin account. It's a beta with low caps while it gets audited.",
    stats: ["yield advances opened", "accounts that took an advance", "USDC of savings locked as collateral"],
    asOf: "Data as of",
    verify: "Verify on stellar.expert",
  },
  security: {
    tag: "Security first",
    title: "Your money, armored at every layer.",
    sub: "Built to institutional standards, with the public-network transparency no one else gives you.",
    layers: [
      { ti: "Verifiable on Stellar", de: "Every transaction is recorded on a public network, so you can check it yourself anytime." },
      { ti: "AES‑256 encryption", de: "Every piece of data and every transaction is encrypted end to end." },
      { ti: "Biometric access", de: "Face ID, PIN and two-step verification so only you can reach your money." },
    ],
  },
  faq: {
    tag: "Questions",
    title: "What you want to know.",
    items: [
      { q: "How does my peso balance earn yield?", a: "Your balance earns yield that is calculated and paid every day. The rate moves with the market and you always see it in the app before moving your money. No lock-ups: use or withdraw your money whenever you want." },
      { q: "Are government bonds risky?", a: "Sovereign debt is among the safest instruments there are. Every bond shows its rating, risk and term before you invest, so you decide with full transparency." },
      { q: "Is the exchange rate really the same as Google's?", a: "Yes. We use the real interbank rate, the same one you see on Google, with no markups or hidden conversion fees." },
      { q: "Is my money protected?", a: "Your account is protected with biometric access and two-step verification, and your data travels encrypted. Plus, every transaction is recorded on the Stellar network, where you can verify it." },
    ],
  },
  final: {
    title: "Start growing your money today.",
    sub: "Open your account in minutes. No opening fees, no minimum balance.",
  },
  footer: {
    tagline: "The finance super app to save, invest and spend without borders.",
    product: "Product", digitalPesos: "Digital pesos", bonds: "Bonds", vaults: "Vaults",
    company: "Company", about: "About us", security: "Security", jobs: "Careers", press: "Press",
    legal: "Legal", terms: "Terms", privacy: "Privacy", fees: "Fees", support: "Support",
    investors: "Investors", investorContact: "Investor contact",
    rights: "© 2026 SEYF. All rights reserved.",
    made: "Built on Stellar · Made in Mexico",
  },
  mock: {
    tabs: { inicio: "Home", ahorro: "Savings", tarjeta: "Card" },
    greet: "Good afternoon",
    toastTi: "SPEI deposit received",
    toastSu: "Already earning yield",
    total: "Total balance",
    available: "Available",
    inVault: "In vaults",
    quick: ["Add", "Send", "Advance", "More"],
    recent: "Recent activity",
    deposit: "SPEI deposit",
    today: "Today",
    yesterday: "Yesterday",
    dailyYield: "Daily yield",
    coffee: "Café La Roma",
    card: "Card",
    convert: "Convert",
    pay: "You pay",
    receive: "You get",
    availableAmt: "Available: $125,400.00",
    usdcHint: "Digital dollar · 1:1 with USD",
    rate: "Exchange rate",
    fee: "Fee",
    arrives: "Arrives in",
    seconds: "~5 seconds",
    done: "Done",
    convertCta: "Convert 1,000 MXN",
    savings: "Savings",
    inVaults: "In your vaults",
    dailyChip: "earns daily",
    earnedMonth: "+$4,028 earned this month",
    goals: "My goals",
    of: "of",
    vaults: ["Trip to Japan", "Emergency fund", "House down payment"],
    perMonth: "/mo",
  },
};

const pt: Dict = {
  nav: { product: "Produto", bonds: "Títulos", security: "Segurança", login: "Entrar", start: "Começar", lang: "Idioma" },
  store: { appSub: "Baixe na", playSub: "Disponível no" },
  hero: {
    words: ["Seu", "dinheiro,", "protegido", "e", "crescendo", "no", "automático."],
    lede: "Seus pesos rendem todos os dias. Sem taxas.",
    cta: "Começar agora",
    how: "Ver como funciona",
    yieldL: "Rende",
    yieldR: "todo dia",
    yieldSub: "Calculado e pago todos os dias sobre seus pesos. Sem prazo de carência.",
    earnedToday: "Ganho hoje",
    withdrawK: "Saques via SPEI",
    withdrawV: "24/7",
    simple: ["Sem seed phrase.", "Sem taxas.", "Sem letras miúdas."],
    simpleSub: "Construído na Stellar: seu dinheiro se move em segundos e é sempre seu.",
    scroll: "Role",
  },
  marqueeFx: "Câmbio real · 0% de taxa",
  manifestoTag: "Por que SEYF",
  manifesto:
    "Dinheiro parado perde para a inflação todos os dias. A SEYF coloca cada peso para trabalhar: rende todo dia, se move em segundos e sai quando você decide. Sem truques, sem surpresas.",
  story: {
    tag: "Como funciona",
    title: "Três passos. Simples assim.",
    steps: [
      { ti: "Deposite via SPEI", de: "Receba sua CLABE na hora. Cada peso que entra começa a render desde o primeiro dia." },
      { ti: "Converta sem spread", de: "Troque para dólar digital no câmbio real, em segundos e sem taxas escondidas." },
      { ti: "Poupe com metas", de: "Crie cofres para suas metas, acompanhe o crescimento e saque para o seu banco quando quiser." },
    ],
    chips: [
      [{ k: "SPEI recebido", v: "+$5,000.00" }, { k: "Sua CLABE", v: "646 180 1234 5678 90" }],
      [{ k: "Câmbio", v: "1 USD = 17.40" }, { k: "Taxa", v: "$0.00" }],
      [{ k: "Viagem ao Japão", v: "64% da meta" }, { k: "Rendimento", v: "Diário" }],
    ],
  },
  stats: ["mínimo para investir em títulos", "depósitos e saques via SPEI", "para mover seu dinheiro na Stellar", "de taxa no câmbio"],
  bonds: {
    tag: "Títulos públicos",
    title: "Rendimentos soberanos, em um toque.",
    sub: "Invista em dívida garantida por governos a partir de $50. Seu dinheiro disponível em 1 dia útil e em custódia regulada.",
    annual: "ao ano",
    from: "A partir de $50",
    liquidity: "Saque em 1 dia útil",
    countries: { mx: "México", us: "Estados Unidos", br: "Brasil", ar: "Argentina", co: "Colômbia", eu: "Europa", kr: "Coreia do Sul" },
    capitals: { mx: "Cidade do México", us: "Washington", br: "Brasília", ar: "Buenos Aires", co: "Bogotá", eu: "Bruxelas", kr: "Seul" },
    short: { us: "EUA", kr: "Coreia" },
  },
  partners: {
    tag: "Construído com",
    title: "A melhor infraestrutura da Stellar.",
    sub: "Cada peça da SEYF roda sobre protocolos abertos e auditáveis do ecossistema.",
    roles: ["Rede de pagamentos · liquidação em ~5 s", "Cofres de rendimento on-chain", "Carteira sem seed phrase", "CETES tokenizados · SPEI"],
  },
  live: {
    tag: "Ao vivo na Stellar",
    title: "O adiantamento já roda na mainnet.",
    sub: "Números lidos do contrato seyf_advance, sem contar a conta administradora do contrato. É uma beta com limites baixos enquanto passa por auditoria.",
    stats: ["adiantamentos de rendimento abertos", "contas que pediram um adiantamento", "USDC de poupança bloqueados como garantia"],
    asOf: "Dados de",
    verify: "Verificar no stellar.expert",
  },
  security: {
    tag: "Segurança em primeiro lugar",
    title: "Seu dinheiro, blindado em cada camada.",
    sub: "Construído com padrões institucionais e com a transparência de uma rede pública que ninguém mais oferece.",
    layers: [
      { ti: "Verificável na Stellar", de: "Cada movimentação fica registrada em uma rede pública: você mesmo pode conferir quando quiser." },
      { ti: "Criptografia AES‑256", de: "Cada dado e cada movimentação trafega criptografado de ponta a ponta." },
      { ti: "Acesso biométrico", de: "Face ID, PIN e verificação em duas etapas para que só você acesse seu dinheiro." },
    ],
  },
  faq: {
    tag: "Perguntas",
    title: "O que você quer saber.",
    items: [
      { q: "Como meu saldo em pesos rende?", a: "Seu saldo gera rendimento calculado e pago todos os dias. A taxa varia com o mercado e você sempre a vê no app antes de mover seu dinheiro. Sem carência: use ou saque seu dinheiro quando quiser." },
      { q: "Títulos públicos têm risco?", a: "A dívida soberana está entre os instrumentos mais seguros que existem. Cada título mostra sua classificação, risco e prazo antes de investir, para você decidir com total transparência." },
      { q: "O câmbio é mesmo igual ao do Google?", a: "Sim. Usamos o câmbio interbancário real, o mesmo que aparece no Google, sem spread nem taxas escondidas na conversão." },
      { q: "Meu dinheiro está protegido?", a: "Sua conta é protegida com acesso biométrico e verificação em duas etapas, e seus dados trafegam criptografados. Além disso, cada movimentação fica registrada na rede Stellar, onde você pode verificá-la." },
    ],
  },
  final: {
    title: "Comece a fazer seu dinheiro crescer hoje.",
    sub: "Abra sua conta em minutos. Sem taxa de abertura e sem saldo mínimo.",
  },
  footer: {
    tagline: "O super app de finanças para poupar, investir e gastar sem fronteiras.",
    product: "Produto", digitalPesos: "Pesos digitais", bonds: "Títulos", vaults: "Cofres",
    company: "Empresa", about: "Sobre nós", security: "Segurança", jobs: "Vagas", press: "Imprensa",
    legal: "Legal", terms: "Termos", privacy: "Privacidade", fees: "Taxas", support: "Suporte",
    investors: "Investidores", investorContact: "Contato para investidores",
    rights: "© 2026 SEYF. Todos os direitos reservados.",
    made: "Construído na Stellar · Feito no México",
  },
  mock: {
    tabs: { inicio: "Início", ahorro: "Poupança", tarjeta: "Cartão" },
    greet: "Boa tarde",
    toastTi: "Depósito SPEI recebido",
    toastSu: "Já está rendendo",
    total: "Patrimônio total",
    available: "Disponível",
    inVault: "Em cofres",
    quick: ["Adicionar", "Enviar", "Adiantamento", "Mais"],
    recent: "Movimentações recentes",
    deposit: "Depósito SPEI",
    today: "Hoje",
    yesterday: "Ontem",
    dailyYield: "Rendimento diário",
    coffee: "Café La Roma",
    card: "Cartão",
    convert: "Converter",
    pay: "Você paga",
    receive: "Você recebe",
    availableAmt: "Disponível: $125,400.00",
    usdcHint: "Dólar digital · 1:1 com USD",
    rate: "Câmbio",
    fee: "Taxa",
    arrives: "Chega em",
    seconds: "~5 segundos",
    done: "Pronto",
    convertCta: "Converter 1,000 MXN",
    savings: "Poupança",
    inVaults: "Nos seus cofres",
    dailyChip: "rende todo dia",
    earnedMonth: "+$4,028 ganhos este mês",
    goals: "Minhas metas",
    of: "de",
    vaults: ["Viagem ao Japão", "Reserva de emergência", "Entrada da casa"],
    perMonth: "/mês",
  },
};

const DICTS: Record<Lang, Dict> = { es, en, pt };
const KEY = "seyf-lang";
const HTML_LANG: Record<Lang, string> = { es: "es-MX", en: "en", pt: "pt-BR" };

const Ctx = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void }>({ lang: "es", t: es, setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");
  // idioma guardado o, la primera vez, el del navegador (español si no es en/pt)
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    const nav = (navigator.language || "es").slice(0, 2);
    const pick = (saved ?? nav) as Lang;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pick in DICTS && pick !== "es") setLangState(pick);
  }, []);
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang];
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  };
  return <Ctx.Provider value={{ lang, t: DICTS[lang], setLang }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** Selector ES · EN · PT para el nav. */
export function LangSwitch() {
  const { lang, t, setLang } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t.nav.lang}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          className={l.id === lang ? "on" : undefined}
          aria-pressed={l.id === lang}
          title={l.name}
          lang={l.id}
          onClick={() => setLang(l.id)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
