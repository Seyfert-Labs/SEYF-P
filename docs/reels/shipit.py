"""Reto Ship It (BAF × Stellar, 23–27 nov 2026): 1 reel + 2 historias de SEYF.
Uso: python3 shipit.py [reel|historia1|historia2 ...]  →  out/seyf-shipit-<nombre>.mp4

Cifras reales al 2026-11-28 (no inventar otras):
- Bóveda USDC (vault Meru de DeFindex, mainnet): 5.2 % anual, de /api/defindex/vault-info.
- CETES a 28 días: 6.20 %, subasta de Banxico del 2026-11-24. En SEYF los CETES
  tokenizados (Etherfuse) solo están en testnet: se dicen "próximamente".
- Adelanto (seyf_advance en mainnet): plazo de 1 a 30 días, topes beta de 1 USDC.
"""
import os
import sys

from PIL import Image

from compose import INK, LIME, VIOLET, WHITE, Fine, Logo, Progress, Sticker, render, W, H
from reels import K, P, OUT

SHIPIT = "/Users/gerryvela/Documents/BAF-Global/baf-website/public/hackathons/mx/ship-it/contenido/ship-it-banner-9x16.png"
CONTRACT = "CCZ77…CWXH"


def shipit_bg():
    return Image.open(SHIPIT).convert("RGB").resize((W, H), Image.LANCZOS)


class FineUntil(Fine):
    """Nota al pie que se apaga antes de la imagen de Ship It."""

    def __init__(self, text, until):
        super().__init__(text)
        self.until = until

    def draw(self, canvas, t):
        if t < self.until:
            super().draw(canvas, t)


def shipit_card(d=2.6):
    return {"d": d, "bg": shipit_bg(), "layers": [], "sfx": [(0.0, "impact", 0.6)]}


def logo_card(d=2.4):
    return {"d": d, "bg": "lime", "sfx": [(0.0, "impact", 0.7)], "layers": [
        Logo(0.05, y=700, width=720, sub=["Tu dinero.", ("Siempre rindiendo.", "v")], sub2=["seyf.app"])]}


# ---------- reel: qué es SEYF ----------
def reel():
    shots = [
        {"d": 1.8, "bg": "ink", "layers": [
            K([["¿Tu", "ahorro"], [("rinde", "l"), ("0%?", "hr")]], size=190, y=640, color=WHITE)],
         "sfx": [(0.05, "pop", 0.6), (0.35, "pop", 0.6)]},
        {"d": 3.0, "layers": [
            K([["Ahorra", "en"], [("dólares", "hl"), "digitales"]]),
            P("boveda", 1.5, 4.6, 3.0, enter="up"),
            Sticker("5.2% anual", 790, 1180, 0.8, bg=LIME, rot=5, sub="Bóveda USDC · hoy")],
         "sfx": [(0.8, "pop", 0.7)]},
        {"d": 3.2, "layers": [
            K([["Rinde", "todos"], ["los", ("días", "hv")]]),
            P("boveda", 4.6, 12.6, 3.2, zoom=(0.3, 3.0, 1.25, 0.5, 0.25)),
            Sticker("Retira cuando quieras", "c", 1560, 1.2, bg=WHITE, rot=-3)],
         "sfx": [(1.2, "tick", 0.5)]},
        {"d": 3.4, "bg": "ink", "layers": [
            K([["Bonos", "del"], [("gobierno", "hl")], ["tokenizados"]], size=150, y=420, color=WHITE),
            Sticker("CETES 28 días · 6.20%", "c", 1050, 0.7, bg=LIME, rot=-3, sub="Banxico, subasta del 24 nov"),
            Sticker("Próximamente en SEYF", "c", 1330, 1.5, bg=VIOLET, fg=WHITE, rot=3)],
         "sfx": [(0.7, "pop", 0.7), (1.5, "pop", 0.6)]},
        {"d": 3.0, "layers": [
            K([[("Cobra", "hl"), "hoy"], ["tus", "intereses"]]),
            P("adelanto", 0.0, 5.3, 3.0, enter="up"),
            Sticker("1 a 30 días", 800, 1250, 1.0, bg=LIME, rot=4)],
         "sfx": [(1.0, "pop", 0.7)]},
        {"d": 2.6, "layers": [
            K([["Sin", "vender"], [("tu", "l"), ("ahorro", "hl")]]),
            P("adelanto", 9.6, 12.4, 2.6, zoom=(0.3, 2.4, 1.2, 0.5, 0.4)),
            Sticker("Adelanto recibido", "c", 1560, 0.9, bg=WHITE, rot=-3)],
         "sfx": [(0.9, "coin", 0.8)]},
        {"d": 2.6, "bg": "ink", "layers": [
            K([["En", ("Stellar", "l")], [("mainnet", "hl")]], size=170, y=560, color=WHITE),
            Sticker("Contrato seyf_advance", "c", 1080, 0.6, bg=WHITE, rot=-2, sub=CONTRACT),
            Sticker("Sin seed phrase · sin comprar XLM", "c", 1330, 1.1, bg=LIME, rot=2, size=46)],
         "sfx": [(0.6, "pop", 0.6), (1.1, "pop", 0.6)]},
        logo_card(),
        shipit_card(),
    ]
    total = sum(s["d"] for s in shots)
    return shots, FineUntil("Rendimientos variables, no garantizados · Beta en mainnet con topes", total - 2.6)


# ---------- historia 1: avance ----------
def historia1():
    d = 9.0
    items = [
        ("Contrato seyf_advance en mainnet", LIME, INK),
        ("Bóvedas USDC · 5.2% anual", WHITE, INK),
        ("Adelanto de 1 a 30 días", WHITE, INK),
        ("v0.1.0 publicado", WHITE, INK),
        ("CETES y SPEI: próximamente", VIOLET, WHITE),
    ]
    layers = [Progress(d), K([["Avance", ("SEYF", "hl")], [("esta", "l"), "semana"]], size=150, y=230, color=WHITE)]
    for i, (txt, bg, fg) in enumerate(items):
        layers.append(Sticker(txt, "c", 640 + i * 210, 0.9 + i * 0.55, bg=bg, fg=fg, rot=(-2 if i % 2 else 2), size=50))
    layers.append(K([["#ShipItBuilder"]], t0=4.2, size=80, y=1740, color=LIME, font="manrope"))
    shots = [{"d": d, "bg": "ink", "layers": layers,
              "sfx": [(0.9 + i * 0.55, "pop", 0.6) for i in range(len(items))]},
             shipit_card()]
    return shots, None


# ---------- historia 2: lo que lanzamos (demo) ----------
def historia2():
    shots = [
        {"d": 4.2, "layers": [
            Progress(10.6),
            K([["Lanzamos:"], [("adelanto", "hl")], ["de", "rendimiento"]], size=120, y=130),
            P("adelanto", 0.0, 5.3, 4.2, enter="up"),
            Sticker("En mainnet", 790, 1250, 1.2, bg=LIME, rot=5)],
         "sfx": [(1.2, "pop", 0.7)]},
        {"d": 3.6, "layers": [
            Progress(10.6),
            K([["Tu", "ahorro", "sigue"], [("rindiendo", "hv")]], size=120, y=150),
            P("adelanto", 9.6, 12.8, 3.6, zoom=(0.3, 3.2, 1.2, 0.5, 0.4)),
            Sticker("Adelanto recibido", "c", 1560, 1.0, bg=WHITE, rot=-3)],
         "sfx": [(1.0, "coin", 0.8)]},
        {"d": 2.8, "bg": "lime", "layers": [
            Progress(10.6),
            Logo(0.05, y=620, width=720, sub=["Pruébalo:", ("seyf.app", "v")], sub2=["#ShipItBuilder"])],
         "sfx": [(0.0, "impact", 0.7)]},
        shipit_card(),
    ]
    return shots, FineUntil("Beta en mainnet con topes · Contrato sin auditar", 10.6)


SCRIPTS = {"reel": reel, "historia1": historia1, "historia2": historia2}

if __name__ == "__main__":
    for name in sys.argv[1:] or list(SCRIPTS):
        shots, fine = SCRIPTS[name]()
        path, dur = render(f"seyf-shipit-{name}", shots, OUT, fine=fine)
        print("ok", path, f"{dur:.1f}s", flush=True)
