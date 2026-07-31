export const calculateGuideSourceCrop = ({ videoWidth, videoHeight, videoRect, guideRect, objectFit }) => {
  const scale = objectFit === 'contain'
    ? Math.min(videoRect.width / videoWidth, videoRect.height / videoHeight)
    : Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const renderedLeft = videoRect.left + (videoRect.width - renderedWidth) / 2;
  const renderedTop = videoRect.top + (videoRect.height - renderedHeight) / 2;
  const left = Math.max(0, (guideRect.left - renderedLeft) / scale);
  const top = Math.max(0, (guideRect.top - renderedTop) / scale);
  const right = Math.min(videoWidth, (guideRect.right - renderedLeft) / scale);
  const bottom = Math.min(videoHeight, (guideRect.bottom - renderedTop) / scale);
  return { left, top, width: right - left, height: bottom - top };
};

export const cropVideoFrameToGuide = (video, guide, canvas, maximumWidth, quality) => {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return '';
  const videoRect = video.getBoundingClientRect();
  const guideRect = guide.getBoundingClientRect();
  if (!videoRect.width || !videoRect.height || !guideRect.width || !guideRect.height) return '';

  const source = calculateGuideSourceCrop({
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    videoRect,
    guideRect,
    objectFit: window.getComputedStyle(video).objectFit
  });
  if (source.width <= 0 || source.height <= 0) return '';

  const outputScale = Math.min(1, maximumWidth / source.width);
  canvas.width = Math.round(source.width * outputScale);
  canvas.height = Math.round(source.height * outputScale);
  canvas.getContext('2d')?.drawImage(
    video,
    source.left,
    source.top,
    source.width,
    source.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas.toDataURL('image/jpeg', quality);
};
