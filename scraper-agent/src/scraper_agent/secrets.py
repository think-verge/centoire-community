"""Per-source logins, kept only in a root-owned 0600 file on the scraper VM.

The YAML specs and the LLM only ever see the *name* of a login (`credential_ref`). Passwords are read here, used by the
login executor, and never logged, written to specs, or put into prompts.
"""

from __future__ import annotations

import os
import stat
from dataclasses import dataclass
from pathlib import Path

import yaml


class SecretsError(RuntimeError):
    pass


@dataclass(frozen=True)
class Credential:
    ref: str
    username: str
    password: str

    def __repr__(self) -> str:  # keeps accidental logging / tracebacks from leaking the password
        return f"Credential(ref={self.ref!r}, username=<redacted>, password=<redacted>)"

    def value(self, field: str) -> str:
        if field not in {"username", "password"}:
            raise SecretsError(f"unknown credential field {field!r}")
        return getattr(self, field)


def _check_permissions(path: Path) -> None:
    mode = stat.S_IMODE(path.stat().st_mode)
    if mode & (stat.S_IRWXG | stat.S_IRWXO):
        raise SecretsError(f"{path} must not be readable by group/others (chmod 600); mode is {mode:o}")


def load_credential(path: Path, ref: str) -> Credential:
    """Reads one login by name. Fails clearly if the file is missing, too open, or lacks the entry."""
    if not path.exists():
        raise SecretsError(f"secrets file not found: {path}")
    _check_permissions(path)
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    entry = data.get(ref)
    if not isinstance(entry, dict) or not entry.get("username") or not entry.get("password"):
        raise SecretsError(f"no username/password for credential_ref {ref!r} in {path.name}")
    return Credential(ref=ref, username=str(entry["username"]), password=str(entry["password"]))


def write_secrets_template(path: Path) -> None:
    """Creates an empty-but-valid secrets file with safe permissions (used by the VM installer)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text("# credential_ref -> login. Keep this file at mode 600.\n# bof:\n#   username: you@example.com\n#   password: change-me\n")
    os.chmod(path, 0o600)
