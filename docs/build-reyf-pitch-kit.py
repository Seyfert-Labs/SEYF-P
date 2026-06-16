#!/usr/bin/env python3
"""Sincroniza la carpeta reyf-pitch-kit lista para compartir (Drive, zip, etc.)."""

import shutil
import zipfile
from pathlib import Path

DOCS = Path(__file__).resolve().parent
KIT = DOCS / "reyf-pitch-kit"
SRC_HTML = DOCS / "reyf-pitch.html"
SRC_VIDEO = DOCS / "reyf-demo.mp4"
LEEME = KIT / "LEEME.txt"

LEEME_TEXT = """REYF PITCH — Carpeta para compartir
====================================

Esta carpeta es autocontenida: presentación HTML + video demo.

CÓMO COMPARTIR (Google Drive, email, etc.)
------------------------------------------
1. Sube esta carpeta completa, o el archivo reyf-pitch-kit.zip
2. Avisa a quien la reciba que debe DESCARGARLA en su computadora
   (la vista previa de Drive NO reproduce bien el HTML ni el video)

CÓMO ABRIR
----------
1. Descomprime si recibiste el .zip
2. Abre index.html con Chrome, Safari o Edge
3. index.html y reyf-demo.mp4 deben estar en la misma carpeta

CÓMO PRESENTAR
--------------
• Flechas ← → o barra espaciadora para cambiar slide
• F = pantalla completa
• El demo en vivo está en la slide "Solución" (video en el marco de celular)

REGENERAR ESTA CARPETA
----------------------
Desde Seyf2/docs:
  python3 build-reyf-pitch-kit.py
"""


def main() -> None:
    if not SRC_HTML.exists():
        raise SystemExit(f"Falta {SRC_HTML}")
    if not SRC_VIDEO.exists():
        raise SystemExit(f"Falta {SRC_VIDEO} — coloca reyf-demo.mp4 en docs/")

    KIT.mkdir(exist_ok=True)
    shutil.copy2(SRC_HTML, KIT / "index.html")
    shutil.copy2(SRC_VIDEO, KIT / "reyf-demo.mp4")
    LEEME.write_text(LEEME_TEXT, encoding="utf-8")

    zip_path = DOCS / "reyf-pitch-kit.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in ("index.html", "reyf-demo.mp4", "LEEME.txt"):
            zf.write(KIT / f, f"reyf-pitch-kit/{f}")

    print(f"Kit listo: {KIT}/")
    print(f"  · index.html")
    print(f"  · reyf-demo.mp4 ({SRC_VIDEO.stat().st_size // 1024 // 1024} MB)")
    print(f"  · LEEME.txt")
    print(f"Zip listo: {zip_path}")


if __name__ == "__main__":
    main()
