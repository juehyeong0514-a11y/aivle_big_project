from __future__ import annotations

import ast
from pathlib import Path


def test_ocr_models_are_not_initialized_during_module_import() -> None:
    # Given: the OCR service module source
    source_path = Path(__file__).parents[1] / "main.py"
    module = ast.parse(source_path.read_text(encoding="utf-8"))

    # When: module-level assignments are inspected
    eager_services = [
        node
        for node in module.body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "service" for target in node.targets)
        and isinstance(node.value, ast.Call)
        and isinstance(node.value.func, ast.Name)
        and node.value.func.id == "IdentityOCRService"
    ]

    # Then: importing FastAPI app does not construct YOLO or PaddleOCR
    assert eager_services == []


if __name__ == "__main__":
    test_ocr_models_are_not_initialized_during_module_import()
