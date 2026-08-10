"""yolo11n.pt를 배포용 ONNX(yolo11n.onnx)로 변환합니다.

로컬에서 한 번만 실행하면 되며, 생성된 yolo11n.onnx를 커밋해서 배포합니다.
서버(ai-proctor-service)는 ultralytics/torch 없이 OpenCV DNN으로 이 파일을 로드합니다.

실행 방법 (프로젝트 루트에서):
    ai-proctor-service\.venv\Scripts\python.exe ai-proctor-service\export_onnx.py

onnx 패키지가 없다면 먼저 설치합니다:
    ai-proctor-service\.venv\Scripts\python.exe -m pip install onnx onnxslim
"""

from __future__ import annotations

from pathlib import Path

from ultralytics import YOLO

# main.py의 추론 입력 크기와 반드시 동일해야 합니다.
IMAGE_SIZE = 320
SERVICE_DIR = Path(__file__).resolve().parent
SOURCE_WEIGHTS = SERVICE_DIR / "yolo11n.pt"
TARGET_ONNX = SERVICE_DIR / "yolo11n.onnx"


def main() -> None:
    if not SOURCE_WEIGHTS.is_file():
        raise SystemExit(f"가중치 파일을 찾을 수 없습니다: {SOURCE_WEIGHTS}")

    exported = YOLO(str(SOURCE_WEIGHTS)).export(
        format="onnx",
        imgsz=IMAGE_SIZE,
        opset=12,
        simplify=False,
        dynamic=False,
        nms=False,
        device="cpu",
    )

    exported_path = Path(exported)
    if exported_path.resolve() != TARGET_ONNX.resolve():
        exported_path.replace(TARGET_ONNX)

    size_mb = TARGET_ONNX.stat().st_size / (1024 * 1024)
    print(f"변환 완료: {TARGET_ONNX} ({size_mb:.1f} MB, imgsz={IMAGE_SIZE})")


if __name__ == "__main__":
    main()
