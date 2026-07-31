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


def test_runtime_uses_onnx_detector_without_ultralytics() -> None:
    service_root = Path(__file__).parents[1]
    source = (service_root / "main.py").read_text(encoding="utf-8")
    requirements = (service_root / "requirements.txt").read_text(encoding="utf-8")

    assert "from ultralytics import YOLO" not in source
    assert "readNetFromONNX" in source
    assert "ultralytics" not in requirements
    assert 'enable_mkldnn=False' in source
    assert 'cpu_threads=1' in source
    assert (service_root / "models" / "best.onnx").is_file()


def test_ocr_runtime_serializes_inference_and_uses_onnxruntime() -> None:
    # Given: the OCR service and mobile capture source
    service_root = Path(__file__).parents[1]
    service_source = (service_root / "main.py").read_text(encoding="utf-8")
    requirements = (service_root / "requirements.txt").read_text(encoding="utf-8")

    # When: deployment runtime and request synchronization are inspected
    route_source = service_source[service_source.index('@app.post("/ocr/id-card/detect"'):]

    # Then: one low-memory ONNX OCR request runs at a time
    assert 'engine="onnxruntime"' in service_source
    assert "inference_lock = Lock()" in service_source
    assert route_source.count("with inference_lock:") == 2
    assert "onnxruntime" in requirements
    assert "paddlepaddle" not in requirements


def test_mobile_id_capture_uses_only_the_visible_guide_area() -> None:
    # Given: the mobile ID capture page
    project_root = Path(__file__).parents[2]
    page_source = (project_root / "frontend" / "src" / "pages" / "MobileIdScanPage.jsx").read_text(encoding="utf-8")
    crop_source = (project_root / "frontend" / "src" / "pages" / "idCardCapture.js").read_text(encoding="utf-8")

    # When: the camera capture path is inspected
    # Then: it measures the rendered guide and crops the source video to that area
    assert "guideFrameRef" in page_source
    assert "cropVideoFrameToGuide" in page_source
    assert "getBoundingClientRect()" in crop_source


if __name__ == "__main__":
    test_ocr_models_are_not_initialized_during_module_import()
    test_ocr_models_start_warming_after_application_startup()
    test_runtime_uses_onnx_detector_without_ultralytics()
    test_ocr_runtime_serializes_inference_and_uses_onnxruntime()
    test_mobile_id_capture_uses_only_the_visible_guide_area()
