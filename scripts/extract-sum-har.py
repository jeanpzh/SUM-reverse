#!/usr/bin/env python3
"""Operator-only: extract five captured SUM responses into a private ZIP."""

import base64
import binascii
import json
import os
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlsplit
import zipfile


JOBS = {
    ("matricula/informacion", "obtenerInformacion"): "matricula-info.json",
    ("matricula/programacion", "obtenerProgramacionAsignaturas"): "programacion-asignaturas.json",
    ("reportes/prematricula", "obtenerAlumnoPrematricula"): "reporte-pre-matricula.json",
    ("reportes/matricula", "obtenerAlumnoMatricula"): "reporte-matricula.json",
    ("reportes/horarios", "obtenerHorariosAsignatura"): "reporte-horario.json",
}
PREFIX = "/alumnoWebSum/v2/"


def invalid_constant(_value):
    raise ValueError("JSON contiene un valor no válido")


def load_json(text):
    return json.loads(text, parse_constant=invalid_constant)


def collect_responses(har):
    log = har.get("log") if isinstance(har, dict) else None
    entries = log.get("entries") if isinstance(log, dict) else None
    if not isinstance(entries, list):
        raise ValueError("El archivo no contiene log.entries de HAR.")
    latest = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        request = entry.get("request")
        if not isinstance(request, dict) or request.get("method") != "GET":
            continue
        url = request.get("url")
        if not isinstance(url, str):
            continue
        try:
            parts = urlsplit(url)
            if parts.scheme != "https" or parts.netloc != "sum.unmsm.edu.pe":
                continue
            if not parts.path.startswith(PREFIX):
                continue
            actions = parse_qs(parts.query).get("accion", [])
            key = (parts.path[len(PREFIX):], actions[0]) if len(actions) == 1 else None
            filename = JOBS.get(key)
        except ValueError:
            continue
        if filename:
            # Last matching capture wins, including errors; never silently use an older success.
            latest[filename] = entry.get("response")

    missing = [name for name in JOBS.values() if name not in latest]
    if missing:
        raise ValueError("Faltan consultas capturadas: " + ", ".join(missing))
    documents = {}
    for filename in JOBS.values():
        response = latest[filename]
        if not isinstance(response, dict) or response.get("status") != 200:
            raise ValueError(f"{filename}: la última captura no tiene HTTP 200.")
        content = response.get("content")
        text = content.get("text") if isinstance(content, dict) else None
        if not isinstance(text, str) or not text:
            raise ValueError(f"{filename}: HAR sin cuerpo; vuelve a capturar esa vista.")
        try:
            encoding = content.get("encoding")
            if encoding == "base64":
                body = base64.b64decode(text, validate=True)
                text = body.decode("utf-8")
            elif encoding in (None, ""):
                body = text.encode("utf-8")
            else:
                raise ValueError("Codificación desconocida")
            value = load_json(text)
        except (ValueError, UnicodeError, binascii.Error, RecursionError):
            raise ValueError(f"{filename}: cuerpo o codificación JSON no válido.") from None
        if not isinstance(value, dict) or not {"message", "codError", "data"} <= value.keys():
            raise ValueError(f"{filename}: faltan claves del envelope.")
        if value["codError"] is not None:
            raise ValueError(f"{filename}: codError no es null.")
        documents[filename] = body
    return documents


def main():
    if len(sys.argv) != 2:
        raise ValueError("Uso: python3 scripts/extract-sum-har.py datos-reales/sum.har")
    private_dir = Path(__file__).resolve().parent.parent / "datos-reales"
    har_path = Path(sys.argv[1]).resolve()
    if private_dir.is_symlink() or har_path.parent != private_dir:
        raise ValueError("Guarda el HAR directamente en datos-reales/ del proyecto.")
    try:
        har = load_json(har_path.read_text(encoding="utf-8-sig"))
    except (ValueError, UnicodeError, RecursionError):
        raise ValueError("No se pudo interpretar el HAR como JSON.") from None
    documents = collect_responses(har)
    output = private_dir / "sum-matricula-json.zip"
    try:
        descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        raise ValueError("El ZIP ya existe en datos-reales/. Renómbralo antes de repetir.") from None
    try:
        with os.fdopen(descriptor, "wb") as target:
            with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                for filename, body in documents.items():
                    archive.writestr("datos-reales/" + filename, body)
    except BaseException:
        output.unlink(missing_ok=True)
        raise
    print("Listo: datos-reales/sum-matricula-json.zip (5 JSON). Extrae en la raíz del proyecto.")


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        print(f"Exportación detenida: {error}", file=sys.stderr)
        sys.exit(1)
    except OSError:
        print("No se pudo leer el HAR o escribir el ZIP. Revisa archivo y permisos.", file=sys.stderr)
        sys.exit(1)
