"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CameraFeedProps {
  onFrame?: (dataUrl: string) => void;
  className?: string;
  /** Mirror the video (selfie view). Default true. */
  mirror?: boolean;
}

type CameraState = "idle" | "requesting" | "active" | "error";

export function CameraFeed({ onFrame, className, mirror = true }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  const startCamera = useCallback(async () => {
    setState("requesting");
    setErrorMsg("");

    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Constraint order: environment (rear) first for factory floor use
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Safari needs playsInline and autoPlay attributes
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("autoplay", "true");
        videoRef.current.muted = true;

        await videoRef.current.play().catch(() => {
          // Ignore play() errors on Safari — autoplay policy may require user gesture
        });
      }

      setState("active");
    } catch (err) {
      const msg =
        err instanceof DOMException
          ? err.name === "NotAllowedError"
            ? "Camera access denied. Allow camera permission and try again."
            : err.name === "NotFoundError"
              ? "No camera found on this device."
              : err.name === "NotReadableError"
                ? "Camera is in use by another application."
                : err.message
          : err instanceof Error
            ? err.message
            : "Failed to access camera.";
      setErrorMsg(msg);
      setState("error");
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState("idle");
  }, []);

  const flipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  // Re-start when facingMode changes while active
  useEffect(() => {
    if (state === "active") {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Optional frame callback — fires at ~10fps to avoid perf issues
  useEffect(() => {
    if (!onFrame || state !== "active") return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      onFrame(canvas.toDataURL("image/jpeg", 0.6));
    }, 100);

    return () => clearInterval(interval);
  }, [onFrame, state]);

  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-black", className)}>
      {/* Video element */}
      <video
        ref={videoRef}
        className={cn(
          "h-full w-full object-cover",
          mirror && state === "active" && facingMode === "user" && "scale-x-[-1]",
        )}
        playsInline
        muted
        autoPlay
      />

      {/* Overlay when inactive */}
      {state !== "active" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
          {state === "error" ? (
            <>
              <CameraOff className="h-10 w-10 text-destructive" />
              <p className="max-w-xs text-center text-sm text-muted-foreground">
                {errorMsg}
              </p>
              <Button size="sm" onClick={startCamera}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </>
          ) : state === "requesting" ? (
            <>
              <Camera className="h-10 w-10 animate-pulse text-primary" />
              <p className="text-sm text-muted-foreground">Requesting camera…</p>
            </>
          ) : (
            <>
              <Camera className="h-10 w-10 text-muted-foreground" />
              <Button onClick={startCamera}>
                <Camera className="mr-2 h-4 w-4" />
                Start Camera
              </Button>
            </>
          )}
        </div>
      )}

      {/* Controls overlay when active */}
      {state === "active" && (
        <div className="absolute bottom-3 right-3 flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-black/50 hover:bg-black/70 border-0"
            onClick={flipCamera}
            title="Flip camera"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-black/50 hover:bg-black/70 border-0"
            onClick={stopCamera}
            title="Stop camera"
          >
            <CameraOff className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Live indicator */}
      {state === "active" && (
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 text-xs font-medium text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          LIVE
        </div>
      )}
    </div>
  );
}
