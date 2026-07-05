"""Make the repo root importable so tests can `import app...`, `tools...`, and
the sibling `harness` module regardless of where pytest is invoked from."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "tests") not in sys.path:
    sys.path.insert(0, str(ROOT / "tests"))
