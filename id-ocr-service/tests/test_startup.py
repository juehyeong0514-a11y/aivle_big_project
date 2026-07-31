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


def test_ocr_models_start_warming_after_application_startup() -> None:
    # Given: the OCR service module source
    source_path = Path(__file__).parents[1] / "main.py"
    module = ast.parse(source_path.read_text(encoding="utf-8"))

    # When: application startup callbacks are inspected
    startup_functions = [
        node
        for node in module.body
        if isinstance(node, ast.FunctionDef)
        and any(
            isinstance(decorator, ast.Call)
            and isinstance(decorator.func, ast.Attribute)
            and decorator.func.attr == "on_event"
            and decorator.args
            and isinstance(decorator.args[0], ast.Constant)
            and decorator.args[0].value == "startup"
            for decorator in node.decorator_list
        )
    ]

    warmup_functions = [
        node
        for node in module.body
        if isinstance(node, ast.FunctionDef) and node.name == "start_ocr_service_warmup"
    ]

    # Then: startup requests warmup and the warmup starts a background thread
    assert startup_functions
    assert any(
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "start_ocr_service_warmup"
        for function in startup_functions
        for node in ast.walk(function)
    )
    assert warmup_functions
    assert any(
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "start"
        for function in warmup_functions
        for node in ast.walk(function)
    )


if __name__ == "__main__":
    test_ocr_models_are_not_initialized_during_module_import()
    test_ocr_models_start_warming_after_application_startup()
