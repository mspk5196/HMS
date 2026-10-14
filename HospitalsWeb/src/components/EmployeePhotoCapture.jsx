import React, { useState, useRef, useEffect } from 'react';

/**
 * Standard passport dimension: 400x400 px square (1:1 aspect ratio)
 * Standardizes any image (webcam or file upload) by center-cropping and resizing.
 */
function standardizeImage(imageElement, targetSize = 400) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    const nw = imageElement.naturalWidth || imageElement.videoWidth || imageElement.width;
    const nh = imageElement.naturalHeight || imageElement.videoHeight || imageElement.height;

    // Calculate center-crop coordinates
    let sx = 0;
    let sy = 0;
    let sSide = Math.min(nw, nh);

    if (nw > nh) {
      sx = Math.floor((nw - nh) / 2);
    } else if (nh > nw) {
      sy = Math.floor((nh - nw) / 2);
    }

    // High quality downsampling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(imageElement, sx, sy, sSide, sSide, 0, 0, targetSize, targetSize);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const file = new File([blob], `employee_photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);
        resolve({ file, previewUrl });
      },
      'image/jpeg',
      0.92
    );
  });
}

export default function EmployeePhotoCapture({
  value = null, // existing photo_path string or null
  onChange,     // (fileOrNull, previewUrlOrNull) => void
  disabled = false,
  label = 'Employee Photograph (Standard 1:1)',
}) {
  const [preview, setPreview] = useState(value || null);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Sync with incoming value if changed externally
  useEffect(() => {
    if (value && typeof value === 'string') {
      setPreview(value);
    } else if (!value) {
      setPreview(null);
    }
  }, [value]);

  // Clean up webcam stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraReady(false);
  };

  const startCamera = async () => {
    setCameraError('');
    setCapturedPreview(null);
    setIsWebcamOpen(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam access is not supported by your browser or environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setIsCameraReady(true);
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError(err.message || 'Unable to access camera. Please allow camera permissions.');
    }
  };

  const closeWebcamModal = () => {
    stopCameraStream();
    setIsWebcamOpen(false);
    setCapturedPreview(null);
    setCameraError('');
  };

  const handleSnapPhoto = async () => {
    if (!videoRef.current) return;
    try {
      const res = await standardizeImage(videoRef.current, 400);
      if (res) {
        setCapturedPreview(res);
      }
    } catch (err) {
      setCameraError('Failed to capture frame from camera.');
    }
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    if (!streamRef.current) {
      startCamera();
    }
  };

  const handleConfirmWebcamPhoto = () => {
    if (capturedPreview) {
      setPreview(capturedPreview.previewUrl);
      onChange?.(capturedPreview.file, capturedPreview.previewUrl);
    }
    closeWebcamModal();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = new Image();
        img.onload = async () => {
          const res = await standardizeImage(img, 400);
          if (res) {
            setPreview(res.previewUrl);
            onChange?.(res.file, res.previewUrl);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to process image file:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setPreview(null);
    onChange?.(null, null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-200">
            {label}
          </label>
          <span className="text-[10px] text-gray-400 font-medium">Standard 400×400 px</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-gray-50/70 dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/[0.08] rounded-xl">
        {/* Photo Preview Container */}
        <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-xs group">
          {preview ? (
            <>
              <img
                src={preview}
                alt="Employee Standard Photo"
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-bold"
                  title="Remove photograph"
                >
                  <svg className="w-5 h-5 mb-0.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400 p-2 text-center">
              <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-[9px] mt-1 text-gray-400">No Photo</span>
            </div>
          )}
        </div>

        {/* Action Buttons & Guidance */}
        <div className="flex-1 space-y-2 text-center sm:text-left">
          <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
            Upload a passport-style portrait or capture directly via webcam. Photos are automatically cropped to standard 1:1 proportion for ID cards and Excel exports.
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            {/* Upload File Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              className="hidden"
              disabled={disabled}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Upload Photo</span>
            </button>

            {/* Webcam Button */}
            <button
              type="button"
              disabled={disabled}
              onClick={startCamera}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Take Picture</span>
            </button>

            {/* Clear Button (if photo exists) */}
            {preview && !disabled && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* WEBCAM CAPTURE MODAL */}
      {isWebcamOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-200 dark:border-white/10 animate-scale-in">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Take Employee Photo</h3>
                  <p className="text-[10px] text-gray-400">Position face centered inside the frame</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeWebcamModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Viewfinder Body */}
            <div className="p-5 flex flex-col items-center">
              {cameraError ? (
                <div className="w-full p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-center space-y-2">
                  <div className="text-rose-600 dark:text-rose-400 text-xs font-semibold">{cameraError}</div>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              ) : capturedPreview ? (
                /* Freeze/Preview State */
                <div className="relative w-64 h-64 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md">
                  <img
                    src={capturedPreview.previewUrl}
                    alt="Captured employee preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                    Standard 1:1 Captured
                  </div>
                </div>
              ) : (
                /* Live Camera State */
                <div className="relative w-64 h-64 rounded-2xl overflow-hidden bg-black flex items-center justify-center border-2 border-gray-300 dark:border-gray-700 shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror-mode"
                    style={{ transform: 'scaleX(-1)' }}
                  />

                  {/* Standard Passport Guidelines Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {/* Passport Face Oval Guide */}
                    <div className="w-36 h-48 border-2 border-dashed border-white/60 rounded-[50%] shadow-2xs" />
                  </div>

                  {!isCameraReady && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-medium">
                      Initializing camera...
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-gray-400 mt-3 text-center">
                {capturedPreview
                  ? 'Review the photo. If satisfied, click "Use Photo" to set as standard profile.'
                  : 'Ensure good lighting and face the camera directly.'}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10 flex items-center justify-end gap-2 bg-gray-50/50 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={closeWebcamModal}
                className="px-3.5 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {capturedPreview ? (
                <>
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="px-3.5 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Retake</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmWebcamPhoto}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Use Photo</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={!isCameraReady}
                  onClick={handleSnapPhoto}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  <span>Snap Photo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
