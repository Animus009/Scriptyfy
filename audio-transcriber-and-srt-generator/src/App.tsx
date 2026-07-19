import React, { useState, useEffect, useRef } from "react";
import { SubtitleSegment, LANGUAGES } from "./types";
import { SegmentRow } from "./components/SegmentRow";
import { 
  segmentsToSrt, 
  segmentsToVtt, 
  segmentsToPlainText, 
  formatTime 
} from "./utils";
import { 
  UploadCloud, 
  FileAudio, 
  Download, 
  Plus, 
  Globe, 
  Sparkles, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Search, 
  Undo,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Lock,
  Mail,
  QrCode,
  History,
  CreditCard,
  Wallet,
  Clock,
  ShieldCheck,
  ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { extractAndDownsampleAudio } from "./lib/audioExtractor";

export default function App() {
  // Config & Status States
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // User Authentication & Credits States
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  
  // Modals Toggles
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  
  // Payment Form State
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [transcribePending, setTranscribePending] = useState<boolean>(false);

  // Admin Payment Reviews
  const [paymentReviews, setPaymentReviews] = useState<any[]>([]);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [adminModalOpen, setAdminModalOpen] = useState<boolean>(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>("");
  const [adminFilterStatus, setAdminFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  
  // Geo-Pricing configuration (shifts automatically according to country)
  const [pricing, setPricing] = useState<{
    currency: string;
    symbol: string;
    price: number;
    credits: number;
    formattedPrice: string;
  }>({
    currency: "USD",
    symbol: "$",
    price: 12.00,
    credits: 2000,
    formattedPrice: "$12.00 USD"
  });

  // Restore session & fetch fresh user data on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("vox_scribe_token");
    if (storedToken) {
      setToken(storedToken);
      fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${storedToken}`
        }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("Stale session");
      })
      .then(data => {
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem("vox_scribe_token");
        setToken(null);
        setUser(null);
      });
    }
  }, []);

  // Detect user's location on mount to shift currency automatically
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const isIndia = timeZone.includes("Calcutta") || timeZone.includes("Kolkata") || timeZone.includes("Asia/Kolkata") || navigator.language === "en-IN" || navigator.language === "hi-IN";
    
    let detectedPricing = {
      currency: "USD",
      symbol: "$",
      price: 12.00,
      credits: 2000,
      formattedPrice: "$12.00 USD"
    };

    if (isIndia) {
      detectedPricing = {
        currency: "INR",
        symbol: "₹",
        price: 1000,
        credits: 2000,
        formattedPrice: "₹1,000 INR"
      };
    } else if (timeZone.includes("Europe")) {
      detectedPricing = {
        currency: "EUR",
        symbol: "€",
        price: 11.00,
        credits: 2000,
        formattedPrice: "€11.00 EUR"
      };
    } else if (timeZone.includes("London") || timeZone.includes("GB") || timeZone.includes("GMT")) {
      detectedPricing = {
        currency: "GBP",
        symbol: "£",
        price: 9.50,
        credits: 2000,
        formattedPrice: "£9.50 GBP"
      };
    } else if (timeZone.includes("Canada") || timeZone.includes("Toronto") || timeZone.includes("Vancouver")) {
      detectedPricing = {
        currency: "CAD",
        symbol: "C$",
        price: 16.50,
        credits: 2000,
        formattedPrice: "C$16.50 CAD"
      };
    } else if (timeZone.includes("Australia") || timeZone.includes("Sydney") || timeZone.includes("Melbourne")) {
      detectedPricing = {
        currency: "AUD",
        symbol: "A$",
        price: 18.00,
        credits: 2000,
        formattedPrice: "A$18.00 AUD"
      };
    }
    
    setPricing(detectedPricing);

    // Dynamic IP Geolocation check
    fetch("https://ipapi.co/json/")
      .then(res => res.json())
      .then(data => {
        const countryCode = data.country_code;
        if (countryCode === "IN") {
          setPricing({ currency: "INR", symbol: "₹", price: 1000, credits: 2000, formattedPrice: "₹1,000 INR" });
        } else if (["DE", "FR", "IT", "ES", "NL", "BE", "AT", "FI", "IE", "PT", "GR"].includes(countryCode)) {
          setPricing({ currency: "EUR", symbol: "€", price: 11.00, credits: 2000, formattedPrice: "€11.00 EUR" });
        } else if (countryCode === "GB") {
          setPricing({ currency: "GBP", symbol: "£", price: 9.50, credits: 2000, formattedPrice: "£9.50 GBP" });
        } else if (countryCode === "CA") {
          setPricing({ currency: "CAD", symbol: "C$", price: 16.50, credits: 2000, formattedPrice: "C$16.50 CAD" });
        } else if (countryCode === "AU") {
          setPricing({ currency: "AUD", symbol: "A$", price: 18.00, credits: 2000, formattedPrice: "A$18.00 AUD" });
        } else {
          setPricing({ currency: "USD", symbol: "$", price: 12.00, credits: 2000, formattedPrice: "$12.00 USD" });
        }
      })
      .catch(() => {
        // Safe to ignore fallback works perfectly
      });
  }, []);

  const fetchReviews = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/payment/review-list", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentReviews(data.reviews || []);
      }
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    }
  };

  const fetchFreshUserData = () => {
    if (!token) return;
    fetch("/api/auth/me", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
    .then(res => {
      if (res.ok) return res.json();
    })
    .then(data => {
      if (data && data.user) {
        setUser(data.user);
      }
    })
    .catch(err => console.error(err));
  };

  const handleApproveReview = async (userEmail: string, txId: string) => {
    try {
      const res = await fetch("/api/payment/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ userEmail, txId })
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentReviews(data.reviews || []);
        if (data.user) {
          setUser(data.user);
        } else {
          fetchFreshUserData();
        }
      } else {
        alert(data.error || "Approval failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectReview = async (userEmail: string, txId: string) => {
    try {
      const res = await fetch("/api/payment/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ userEmail, txId })
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentReviews(data.reviews || []);
        if (data.user) {
          setUser(data.user);
        } else {
          fetchFreshUserData();
        }
      } else {
        alert(data.error || "Rejection failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (paymentModalOpen || adminModalOpen) {
      fetchReviews();
    }
  }, [paymentModalOpen, adminModalOpen, token]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      localStorage.setItem("vox_scribe_token", data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthModalOpen(false);
      setAuthEmail("");
      setAuthPassword("");

      if (transcribePending) {
        setTranscribePending(false);
        setTimeout(() => {
          handleStartTranscriptionDirectly(data.token);
        }, 150);
      }
    } catch (err: any) {
      setAuthError(err.message || "An unexpected error occurred.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRef = paymentReference.trim();
    if (!cleanRef) {
      setPaymentError("Please enter your transaction ID or UTR.");
      return;
    }
    if (!/^\d+$/.test(cleanRef)) {
      setPaymentError("Invalid Transaction ID / UTR. Only numbers (digits 0-9) are allowed.");
      return;
    }

    setPaymentError(null);
    setPaymentLoading(true);

    try {
      const res = await fetch("/api/payment/topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          referenceId: cleanRef,
          amountPaid: pricing.price,
          currency: pricing.currency
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify transaction.");
      }

      setUser(data.user);
      setPaymentSuccess(true);
      setPaymentReference("");
    } catch (err: any) {
      setPaymentError(err.message || "Failed to verify transaction.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("vox_scribe_token");
    setToken(null);
    setUser(null);
  };
  
  // File Loading States
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>("");
  const [isVideoFile, setIsVideoFile] = useState<boolean>(false);
  
  // Transcription Config States
  const [selectedLanguage, setSelectedLanguage] = useState<string>("Auto-detect");
  const [promptHint, setPromptHint] = useState<string>("");
  
  // Backend Processing States
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [transcribeStep, setTranscribeStep] = useState<string>("");
  
  // Editor States
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Refs
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check backend config on mount
  useEffect(() => {
    fetch("/api/config-status")
      .then((res) => res.json())
      .then((data) => setHasApiKey(data.hasApiKey))
      .catch(() => setHasApiKey(false));
  }, []);

  // Sync volume & mute on media element changes
  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Sync speed on media element changes
  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, audioUrl]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl && audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Auto-scroll and highlight active segment during playback
  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  );

  useEffect(() => {
    if (activeSegment) {
      const el = document.getElementById(`segment-row-${activeSegment.id}`);
      if (el && isPlaying) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeSegment?.id, isPlaying]);

  // Handle local file loading
  const handleFileChange = (file: File) => {
    if (!file) return;
    
    // Revoke old URL if any
    if (audioUrl && audioUrl.startsWith("blob:")) {
      URL.revokeObjectURL(audioUrl);
    }

    const url = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioUrl(url);
    setAudioName(file.name);
    
    // Detect if file is video
    const isVideo = file.type.startsWith("video/") || 
                    file.name.endsWith(".mp4") || 
                    file.name.endsWith(".webm") || 
                    file.name.endsWith(".mov") || 
                    file.name.endsWith(".mkv") || 
                    file.name.endsWith(".avi");
    setIsVideoFile(isVideo);

    setTranscribeError(null);
    setSegments([]); // reset editor
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const isSupported = file.type.startsWith("audio/") || 
                          file.type.startsWith("video/") ||
                          file.name.endsWith(".mp3") || 
                          file.name.endsWith(".wav") || 
                          file.name.endsWith(".m4a") || 
                          file.name.endsWith(".ogg") || 
                          file.name.endsWith(".aac") ||
                          file.name.endsWith(".mp4") ||
                          file.name.endsWith(".webm") ||
                          file.name.endsWith(".mov") ||
                          file.name.endsWith(".mkv") ||
                          file.name.endsWith(".avi");
      if (isSupported) {
        handleFileChange(file);
      } else {
        setTranscribeError("Please upload a valid audio or video file (MP3, WAV, MP4, WEBM, MOV, etc.).");
      }
    }
  };

  // Convert uploaded audio/video file to base64 and trigger transcription API
  const handleStartTranscription = async () => {
    if (!token) {
      setTranscribePending(true);
      setAuthMode("register");
      setAuthModalOpen(true);
      return;
    }
    await handleStartTranscriptionDirectly(token);
  };

  const handleStartTranscriptionDirectly = async (authToken: string) => {
    if (!audioFile) return;

    setIsTranscribing(true);
    setTranscribeError(null);
    setTranscribeStep("Preparing transcription pipeline...");

    try {
      let finalBlob: Blob = audioFile;
      let finalMimeType = audioFile.type;

      // Determine starting MIME type if not present
      if (!finalMimeType) {
        if (audioFile.name.endsWith(".mp3")) finalMimeType = "audio/mp3";
        else if (audioFile.name.endsWith(".wav")) finalMimeType = "audio/wav";
        else if (audioFile.name.endsWith(".m4a")) finalMimeType = "audio/m4a";
        else if (audioFile.name.endsWith(".ogg")) finalMimeType = "audio/ogg";
        else if (audioFile.name.endsWith(".mp4")) finalMimeType = "video/mp4";
        else if (audioFile.name.endsWith(".webm")) finalMimeType = "video/webm";
        else if (audioFile.name.endsWith(".mov")) finalMimeType = "video/quicktime";
        else if (audioFile.name.endsWith(".mkv")) finalMimeType = "video/x-matroska";
        else if (audioFile.name.endsWith(".avi")) finalMimeType = "video/x-msvideo";
        else finalMimeType = "audio/mpeg";
      }

      // Try local browser-based audio track extraction and downsampling (speeds up process by up to 10x!)
      try {
        const result = await extractAndDownsampleAudio(audioFile, 16000, (stepMsg) => {
          setTranscribeStep(stepMsg);
        });
        finalBlob = result.blob;
        finalMimeType = result.mimeType;
      } catch (extractorErr) {
        console.warn("Local audio extractor failed/unsupported, falling back to original file upload:", extractorErr);
        setTranscribeStep("Reading raw media file (standard upload)...");
      }

      // Convert the final processed Blob/File to base64
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(finalBlob);
      });

      // Show upload status
      setTranscribeStep("Uploading optimized speech payload to server...");
      
      const serverAnalysisTimeout = setTimeout(() => {
        setTranscribeStep("Gemini is listening & decoding speech patterns...");
      }, 1500);

      // Make the API Call
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          audioData: base64String,
          mimeType: finalMimeType,
          language: selectedLanguage,
          promptHint: promptHint,
        }),
      });

      clearTimeout(serverAnalysisTimeout);

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          // Open payment top-up modal directly if credits are over
          setPaymentModalOpen(true);
        }
        throw new Error(data.error || "An error occurred during transcription.");
      }

      if (!data.segments || !Array.isArray(data.segments)) {
        throw new Error("Invalid response format. No transcript segments found.");
      }

      // Add a client-side generated UUID/ID to each segment
      const formattedSegments = data.segments.map((seg: any, i: number) => ({
        id: `seg-${Date.now()}-${i}`,
        start: Number(seg.start) || 0,
        end: Number(seg.end) || 0,
        text: String(seg.text || "").trim(),
      }));

      setSegments(formattedSegments);
      
      // Update user state if provided in response
      if (data.user) {
        setUser(data.user);
      }

      setIsTranscribing(false);
    } catch (err: any) {
      console.error(err);
      setTranscribeError(err.message || "Failed to transcribe audio.");
      setIsTranscribing(false);
    }
  };

  // Pre-load a sample project
  const handleLoadSample = () => {
    // We will use a friendly royalty-free audio file or simply mock the player state
    // Let's load standard segments
    setAudioName("Sample_Tech_Pitch.mp3");
    setAudioUrl("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"); // Standard test mp3
    setAudioFile(null); // Clear manual file
    
    const sampleSegments: SubtitleSegment[] = [
      { id: "sample-1", start: 0.0, end: 4.5, text: "Hello and welcome to the future of digital accessibility." },
      { id: "sample-2", start: 4.5, end: 9.2, text: "In this presentation, we are excited to showcase our smart multi-language subtitling editor." },
      { id: "sample-3", start: 9.2, end: 14.8, text: "By using the powerful Gemini 3.5 model, we are able to transcribe speech in all languages seamlessly." },
      { id: "sample-4", start: 14.8, end: 19.5, text: "The system generates perfectly synchronized timeframes that are fully editable." },
      { id: "sample-5", start: 19.5, end: 24.3, text: "You can click on any segment on the right side to jump the audio player to that exact moment." },
      { id: "sample-6", start: 24.3, end: 30.0, text: "And once you're happy with your edits, simply download your completed SRT, VTT, or plain text file instantly!" }
    ];

    setSegments(sampleSegments);
    setTranscribeError(null);
    setCurrentTime(0);
    setDuration(180); // soundhelix track is long
  };

  // Media Playback Controls
  const togglePlay = () => {
    if (!audioUrl) return;
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause();
      } else {
        mediaRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (mediaRef.current) {
      mediaRef.current.currentTime = val;
    }
  };

  // Seek and play specific segment
  const handlePlaySegment = (start: number, end: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = start;
      setCurrentTime(start);
      if (!isPlaying) {
        mediaRef.current.play();
        setIsPlaying(true);
      }
      
      // Optional: pause automatically when segment ends
      const checkEnd = () => {
        if (mediaRef.current && mediaRef.current.currentTime >= end) {
          mediaRef.current.pause();
          setIsPlaying(false);
          mediaRef.current.removeEventListener("timeupdate", checkEnd);
        }
      };
      mediaRef.current.addEventListener("timeupdate", checkEnd);
    }
  };

  // Jump playhead directly to timestamp
  const jumpToTime = (seconds: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  // Editor Operations
  const handleUpdateSegment = (id: string, updatedFields: Partial<SubtitleSegment>) => {
    setSegments((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, ...updatedFields } : seg))
    );
  };

  const handleDeleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((seg) => seg.id !== id));
  };

  const handleAddSegment = () => {
    // Insert new segment at current playhead or at the end
    const lastSeg = segments[segments.length - 1];
    const newStart = lastSeg ? lastSeg.end : currentTime;
    const newEnd = newStart + 3.0; // 3 seconds default

    const newSeg: SubtitleSegment = {
      id: `seg-manual-${Date.now()}`,
      start: newStart,
      end: newEnd,
      text: "New subtitle segment text...",
    };

    setSegments((prev) => [...prev, newSeg].sort((a, b) => a.start - b.start));
  };

  // Shift all timestamps by a delay (+ or - offset)
  const handleShiftTimestamps = (seconds: number) => {
    setSegments((prev) =>
      prev.map((seg) => ({
        ...seg,
        start: Math.max(0, seg.start + seconds),
        end: Math.max(0, seg.end + seconds),
      }))
    );
  };

  // Downloads / Exports
  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadSrtFile = () => {
    const srt = segmentsToSrt(segments);
    const cleanAudioName = audioName.replace(/\.[^/.]+$/, "");
    triggerDownload(srt, `${cleanAudioName || "subtitles"}.srt`, "text/srt");
  };

  const downloadVttFile = () => {
    const vtt = segmentsToVtt(segments);
    const cleanAudioName = audioName.replace(/\.[^/.]+$/, "");
    triggerDownload(vtt, `${cleanAudioName || "subtitles"}.vtt`, "text/vtt");
  };

  const downloadPlainTextFile = () => {
    const txt = segmentsToPlainText(segments);
    const cleanAudioName = audioName.replace(/\.[^/.]+$/, "");
    triggerDownload(txt, `${cleanAudioName || "transcript"}.txt`, "text/plain");
  };

  // Filtered Segments based on text search
  const filteredSegments = segments.filter((seg) =>
    seg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pseudo sound wave mock (40 bars) for visualization
  const waveBars = [
    12, 24, 36, 16, 28, 48, 18, 12, 32, 64, 42, 20, 16, 28, 54, 72, 36, 24, 18, 32,
    44, 52, 28, 12, 20, 36, 50, 68, 42, 24, 16, 10, 28, 42, 58, 32, 18, 14, 24, 36
  ];

  return (
    <div className="flex flex-col h-screen w-full bg-[#F8F9FA] font-sans text-slate-800 overflow-hidden">
      {/* Hidden audio element (only if not a video file) */}
      {audioUrl && !isVideoFile && (
        <audio
          ref={mediaRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {/* Header Navigation */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-xs">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
            </svg>
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900 uppercase">VOX-SCRIBE</span>
            <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium ml-2 uppercase tracking-wider">Audio & Video Transcriber</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasApiKey === false && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-amber-700 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Configure Gemini Key in Secrets</span>
            </div>
          )}
          {hasApiKey === true && !user && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Gemini Ready</span>
            </div>
          )}

          {user && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-xs font-bold text-indigo-900 tracking-tight">
                {user.credits?.toLocaleString() || 0} Credits
              </span>
              <button
                onClick={() => {
                  setPaymentSuccess(false);
                  setPaymentError(null);
                  setPaymentModalOpen(true);
                }}
                className="ml-1.5 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-extrabold uppercase tracking-wider transition-all"
                id="header-buy-credits-btn"
              >
                Top Up
              </button>
            </div>
          )}

          {audioUrl && (
            <button
              onClick={() => {
                setAudioFile(null);
                setAudioUrl(null);
                setAudioName("");
                setSegments([]);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all"
            >
              Clear Workspace
            </button>
          )}

          <div className="h-6 w-px bg-slate-200"></div>

          {user ? (
            <div className="flex items-center gap-2">
              {user.email === "garainpuja53@gmail.com" && (
                <button
                  onClick={() => {
                    fetchReviews();
                    setAdminModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                  id="header-admin-btn"
                >
                  <span>🛡️ Admin Dashboard</span>
                </button>
              )}
              <span className="hidden md:inline-block text-xs font-semibold text-slate-600 max-w-[120px] truncate" title={user.email}>
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-all"
                id="header-signout-btn"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setAuthError(null);
                setAuthModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              id="header-signin-btn"
            >
              Sign In / Register
            </button>
          )}
        </div>
      </header>

      {/* Main Editor Viewport */}
      <main className="flex flex-1 overflow-hidden relative">
        {!user ? (
          <div className="flex-1 flex flex-col lg:flex-row items-center justify-center bg-[#F8F9FA] relative overflow-hidden p-4 md:p-8">
            {/* Background decorative elements */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-200/40 rounded-full filter blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-200/40 rounded-full filter blur-3xl animate-pulse"></div>

            <div className="w-full max-w-4xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col md:flex-row z-10 min-h-[500px]">
              {/* Product Info Panel */}
              <div className="w-full md:w-1/2 bg-slate-900 text-white p-8 flex flex-col justify-between relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-slate-950/40 to-slate-950/90 opacity-85"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                      </svg>
                    </div>
                    <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-400">VOX-SCRIBE</span>
                  </div>

                  <h2 className="text-2xl font-extrabold tracking-tight text-white mb-3 leading-tight">
                    Professional Audio & Video Transcription
                  </h2>
                  <p className="text-slate-300 text-xs leading-relaxed mb-6">
                    Convert any podcast, interview, or lecture video into perfect, time-synchronized subtitles and SRT files instantly powered by Gemini 1.5.
                  </p>

                  {/* Feature Highlights */}
                  <div className="flex flex-col gap-4">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-indigo-400 shrink-0">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Fast Transcription</h4>
                        <p className="text-[11px] text-slate-400">Uses local browser pre-processing for speed up to 10x faster.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-indigo-400 shrink-0">
                        <CreditCard className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">20,000 Free Credits</h4>
                        <p className="text-[11px] text-slate-400">Get 20,000 free credits upon registration (sufficient for 20 subtitle conversions!).</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-indigo-400 shrink-0">
                        <Lock className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Verified Sign-Up</h4>
                        <p className="text-[11px] text-slate-400">Disposable temporary email domains are actively filtered to maintain security.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 pt-6 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
                  <span>Powered by Gemini 1.5 Flash</span>
                  <span>Secure & SSL Protected</span>
                </div>
              </div>

              {/* Login / Signup form panel */}
              <div className="flex-1 p-8 flex flex-col justify-center bg-white">
                <div className="max-w-xs mx-auto w-full">
                  {/* Tabs */}
                  <div className="flex border-b border-slate-100 bg-slate-50 p-1 rounded-xl mb-5">
                    <button
                      onClick={() => {
                        setAuthMode("login");
                        setAuthError(null);
                      }}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        authMode === "login"
                          ? "bg-white text-indigo-600 shadow-2xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => {
                        setAuthMode("register");
                        setAuthError(null);
                      }}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        authMode === "register"
                          ? "bg-white text-indigo-600 shadow-2xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Create Account
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    {authMode === "login" ? "Sign In" : "Register & claim 20k credits"}
                  </h3>
                  <p className="text-slate-400 text-[11px] mb-5">
                    {authMode === "login" ? "Welcome back! Log in to continue transcribing" : "Get started for free today with zero credit card required"}
                  </p>

                  {authError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex gap-2 items-start mb-4">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3.5">
                    {/* Email Input */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="email"
                          required
                          placeholder="name@company.com"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Password Input */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="mt-1 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {authLoading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                      <span>{authMode === "login" ? "Sign In to Account" : "Register & Get 20,000 Credits"}</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Sidebar / Audio Controls */}
            <aside className="w-[320px] bg-white border-r border-slate-200 p-6 flex flex-col shrink-0 h-full overflow-y-auto">
              {/* Credit Status & Top-Up Wallet Controller */}
              <div className="mb-6 p-4 bg-gradient-to-br from-indigo-50 to-indigo-100/60 border border-indigo-150 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Your Account</span>
                  <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-extrabold uppercase tracking-wide">
                    ACTIVE
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    {user.credits?.toLocaleString() || 0}
                  </span>
                  <span className="text-xs font-bold text-slate-500">Credits</span>
                </div>
                <p className="text-[11px] text-slate-600 mb-3.5 leading-relaxed">
                  Have credits remaining? You can still top up and add more credits to your wallet anytime!
                </p>
                <button
                  onClick={() => {
                    setPaymentSuccess(false);
                    setPaymentError(null);
                    setPaymentModalOpen(true);
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5"
                  id="sidebar-topup-btn"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Buy 2,000 Credits</span>
                </button>
              </div>

              {/* Media Source / Upload Panel */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Media Source</h3>
            
            {!audioFile && !audioUrl ? (
              <div 
                onDragOver={onDragOver}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className="p-5 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl bg-slate-50/50 hover:bg-slate-50 text-center cursor-pointer transition-all duration-200"
              >
                <UploadCloud className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-700 mb-0.5">Drag audio or video or click</p>
                <p className="text-[10px] text-slate-400">Supports MP3, WAV, MP4, WEBM up to 50MB</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  accept="audio/*,video/*"
                  className="hidden"
                />
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="font-semibold text-slate-800 text-sm truncate" title={audioName}>{audioName || "Untitled Media"}</p>
                <p className="text-[11px] text-slate-500 mt-1 flex justify-between">
                  <span>{formatTime(duration).replace(",000", "")}</span>
                  {audioFile && <span>{(audioFile.size / (1024 * 1024)).toFixed(1)} MB</span>}
                </p>
                
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-1 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    Change File
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                    accept="audio/*,video/*"
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Video Preview Player (Only if a video file is loaded) */}
          {audioUrl && isVideoFile && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Video Preview</h3>
              <div className="relative w-full rounded-xl overflow-hidden bg-black border border-slate-200 aspect-video shadow-xs group">
                <video
                  ref={mediaRef}
                  src={audioUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={togglePlay}
                />
                
                {/* Play/Pause overlay */}
                {!isPlaying && (
                  <div 
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-lg text-slate-800 transform hover:scale-110 active:scale-95 transition-all">
                      <Play className="w-4 h-4 fill-slate-800 ml-0.5" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audio Visualizer */}
          {audioUrl && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Visualizer</h3>
              <div className="h-16 bg-slate-900 rounded-xl flex items-end justify-between px-3.5 gap-0.5 py-3 overflow-hidden border border-slate-800 shrink-0">
                {waveBars.map((height, i) => {
                  const progress = i / waveBars.length;
                  const audioProgress = duration ? currentTime / duration : 0;
                  const isPassed = progress <= audioProgress;
                  return (
                    <button
                      key={i}
                      onClick={() => duration && jumpToTime((progress * duration))}
                      title={`Jump to ${(progress * 100).toFixed(0)}%`}
                      style={{ height: `${height}%` }}
                      className={`w-full rounded-full transition-all duration-150 ${
                        isPassed ? "bg-indigo-400" : "bg-indigo-950 hover:bg-indigo-900"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Transcription Settings */}
          {audioUrl && (
            <div className="space-y-4 mb-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Translation & Settings</h3>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Spoken Language</label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer text-slate-700"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.name}>
                      {lang.name} {lang.nativeName !== lang.name ? `(${lang.nativeName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Vocabulary Hint</label>
                <input
                  type="text"
                  value={promptHint}
                  onChange={(e) => setPromptHint(e.target.value)}
                  placeholder="Acronyms, spelling of names..."
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500 text-slate-700"
                />
              </div>

              {segments.length === 0 && !isTranscribing ? (
                <button
                  onClick={handleStartTranscription}
                  disabled={!audioFile}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                >
                  Generate Transcript with Gemini
                </button>
              ) : segments.length > 0 && !isTranscribing ? (
                <button
                  onClick={handleStartTranscription}
                  disabled={!audioFile}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-medium transition-all"
                >
                  Re-Generate Transcript
                </button>
              ) : null}
            </div>
          )}

          {/* Sync Adjustment Tool */}
          {segments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2.5">Sync Delay</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleShiftTimestamps(-0.5)}
                  className="py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium rounded-lg border border-slate-200 transition-colors"
                >
                  -0.5s Delay
                </button>
                <button
                  onClick={() => handleShiftTimestamps(0.5)}
                  className="py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium rounded-lg border border-slate-200 transition-colors"
                >
                  +0.5s Delay
                </button>
              </div>
            </div>
          )}

          {/* Transcription Error Notification */}
          {transcribeError && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-100 rounded-xl flex gap-2.5 items-start">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-red-800">Transcription Failed</h4>
                <p className="text-[11px] text-red-600 mt-1 leading-relaxed">{transcribeError}</p>
              </div>
            </div>
          )}

          {/* Player controls anchored to the bottom of the sidebar */}
          {audioUrl && (
            <div className="mt-auto pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center mb-2.5 text-[11px]">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Playback Speed</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-600 cursor-pointer focus:outline-none"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1.0}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2.0}>2.0x</option>
                </select>
              </div>

              {/* Progress seeker slider */}
              <div className="flex flex-col gap-1 mb-3.5">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>{formatTime(currentTime).replace(",000", "")}</span>
                  <span>{formatTime(duration).replace(",000", "")}</span>
                </div>
              </div>

              {/* Controls ribbon */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-900 rounded-2xl">
                <button 
                  onClick={() => jumpToTime(Math.max(0, currentTime - 5))}
                  title="Rewind 5 seconds"
                  className="p-1.5 text-white opacity-70 hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z"></path>
                  </svg>
                </button>
                
                <button 
                  onClick={togglePlay}
                  className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-md hover:scale-105 active:scale-95 transition-all"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-slate-900 stroke-slate-900" />
                  ) : (
                    <Play className="w-4 h-4 fill-slate-900 stroke-slate-900 ml-0.5" />
                  )}
                </button>

                <button 
                  onClick={() => jumpToTime(Math.min(duration, currentTime + 5))}
                  title="Forward 5 seconds"
                  className="p-1.5 text-white opacity-70 hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z"></path>
                  </svg>
                </button>

                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 text-white opacity-70 hover:opacity-100 transition-opacity"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Editor Canvas Container */}
        <section className="flex-1 p-8 flex flex-col bg-slate-50 overflow-hidden h-full">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Transcript Editor</h2>
              <p className="text-xs text-slate-400">Perfect, synchronize, and adjust subtitle segment texts side-by-side with audio.</p>
            </div>

            <div className="flex items-center gap-2">
              {segments.length > 0 && (
                <>
                  <button
                    onClick={downloadSrtFile}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Download SRT</span>
                  </button>
                  <div className="h-4 w-px bg-slate-200 mx-1"></div>
                </>
              )}

              <button
                onClick={handleLoadSample}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100/50 text-indigo-600 rounded-lg text-xs font-semibold transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Try Sample</span>
              </button>
            </div>
          </div>

          {/* Subtitle segments count / search bar */}
          {segments.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0 bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
              {/* Search input field */}
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subtitle text..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Stats & Adding Segment */}
              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                <span className="text-[11px] font-mono text-slate-400">
                  Showing {filteredSegments.length} of {segments.length} rows
                </span>
                
                <button
                  onClick={handleAddSegment}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Row</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Segment Table Grid */}
          <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200 flex flex-col overflow-hidden">
            {/* Table Header Row */}
            <div className="grid grid-cols-1 md:grid-cols-[170px,1fr] bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 text-[10px] uppercase tracking-widest shrink-0 select-none">
              <div className="p-3 text-center">Timestamp & Play</div>
              <div className="p-3 border-l border-slate-200">Subtitle Content</div>
            </div>

            {/* Scrollable Transcript rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
              {/* Spinner while transcription is happening */}
              {isTranscribing && (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                  <div className="relative w-12 h-12 mb-3">
                    <div className="absolute inset-0 rounded-full border-3 border-slate-100"></div>
                    <div className="absolute inset-0 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin"></div>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">{transcribeStep}</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                    Gemini is processing speech waves and building interactive subtitle blocks...
                  </p>
                </div>
              )}

              {/* Transcript rows display */}
              {!isTranscribing && segments.length > 0 && (
                filteredSegments.length > 0 ? (
                  filteredSegments.map((seg) => (
                    <SegmentRow
                      key={seg.id}
                      segment={seg}
                      index={segments.indexOf(seg)}
                      isActive={activeSegment?.id === seg.id}
                      onUpdate={handleUpdateSegment}
                      onDelete={handleDeleteSegment}
                      onPlaySegment={handlePlaySegment}
                    />
                  ))
                ) : (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                    <Search className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No matching search rows</p>
                    <p className="text-xs text-slate-400 mt-1">Clear the search bar to show all segments</p>
                  </div>
                )
              )}

              {/* Welcome/Empty state placeholder */}
              {!isTranscribing && segments.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">VOX-SCRIBE Workspace</h3>
                  <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-6">
                    A clean, minimal, and powerful transcript builder. Connect your media and see your words align with millisecond-precision immediately.
                  </p>
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
                    >
                      Upload Audio File
                    </button>
                    <button
                      onClick={handleLoadSample}
                      className="px-4.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 rounded-lg transition-colors"
                    >
                      Load Sample Track
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Table Footer / Exports Block */}
            {segments.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 select-none">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Export transcripts
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={downloadPlainTextFile}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-3xs"
                  >
                    Plain Text (.txt)
                  </button>
                  <button
                    onClick={downloadVttFile}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-3xs"
                  >
                    WebVTT (.vtt)
                  </button>
                  <button
                    onClick={downloadSrtFile}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download SRT File</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
        </>)}
      </main>

      {/* MODAL 1: Authentication Modal */}
      <AnimatePresence>
        {authModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>{authMode === "login" ? "Welcome Back to VoxScribe" : "Create Your Free Account"}</span>
                </h3>
                <button
                  onClick={() => {
                    setAuthModalOpen(false);
                    setTranscribePending(false);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Toggle Tabs */}
              <div className="flex border-b border-slate-100 bg-slate-50 p-1">
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    authMode === "login"
                      ? "bg-white text-indigo-600 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    authMode === "register"
                      ? "bg-white text-indigo-600 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Register
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleAuthSubmit} className="p-6 flex flex-col gap-4">
                {transcribePending && (
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800 text-xs leading-relaxed flex gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block">Transcribe & Edit Now</strong>
                      Register or sign in to instantly transcribe your media! Registering grants you <strong>20,000 free credits</strong>.
                    </div>
                  </div>
                )}

                {authMode === "register" && !transcribePending && (
                  <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-[11px] leading-relaxed flex gap-2">
                    <Wallet className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block">Free Signup Bonus!</strong>
                      Get <strong>20,000 credits</strong> instantly on registration! Temporary/disposable email addresses are blocked.
                    </div>
                  </div>
                )}

                {authError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Email Address */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="you@domain.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="mt-2 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {authLoading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>{authMode === "login" ? "Sign In to Account" : "Register & Get 20,000 Credits"}</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Credit Billing Top-Up Modal */}
      <AnimatePresence>
        {paymentModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:max-h-[600px]"
            >
              {/* Left Column: QR Scan Panel (UPI Integration) */}
              <div className="w-full md:w-[350px] bg-slate-950 text-white p-8 flex flex-col justify-between shrink-0 border-r border-slate-800 relative overflow-hidden">
                <div className="absolute inset-0 bg-radial-[circle_at_top] from-indigo-950/45 via-transparent to-transparent opacity-60"></div>
                
                <div className="relative z-10">
                  <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest inline-block mb-4">
                    Instant Upgrade
                  </span>
                  <h3 className="text-xl font-bold tracking-tight mb-2">Claim 2,000 Credits</h3>
                  <p className="text-slate-400 text-xs leading-relaxed mb-6">
                    Each full-length subtitle file costs 100 credits. Scanning this code gives you 2,000 credits to power up to 20 subtitle transcriptions!
                  </p>
                </div>

                {/* QR Display Area */}
                <div className="relative z-10 flex flex-col items-center justify-center my-4 bg-white rounded-2xl p-4 shadow-xl max-w-[240px] mx-auto border border-slate-800">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi%3A%2F%2Fpay%3Fpa%3Dgarainpuja53%40okaxis%26pn%3DVoxScribe%26cu%3D${pricing.currency}%26am%3D${pricing.price}`}
                    alt="Scan UPI QR"
                    className="w-40 h-40 object-contain rounded animate-pulse"
                    referrerPolicy="no-referrer"
                  />
                  <div className="mt-3 flex items-center gap-1.5 text-slate-900">
                    <QrCode className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-[11px] font-bold">UPI / Global QR Code</span>
                  </div>
                </div>

                <div className="relative z-10 text-center mt-4">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                    Amount to pay
                  </p>
                  <p className="text-2xl font-extrabold text-white tracking-tight mt-0.5">
                    {pricing.formattedPrice}
                  </p>
                  <p className="text-[10px] text-indigo-400 font-medium mt-1 leading-relaxed">
                    Auto-localized based on region
                  </p>
                </div>
              </div>

              {/* Right Column: Verification & Logs */}
              <div className="flex-1 p-8 flex flex-col justify-between overflow-y-auto bg-slate-50">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Submit UTR / Verification</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">Enter transaction details to verify credits</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPaymentModalOpen(false);
                        setPaymentSuccess(false);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition hover:bg-slate-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {paymentSuccess ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-xs">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900">Payment Submitted for Review!</h4>
                    <p className="text-xs text-slate-500 max-w-sm mt-1 mb-6 leading-relaxed">
                      Your reference number has been successfully recorded. An administrator will verify the payment shortly. Once approved, 2,000 credits will be instantly added to your account!
                    </p>
                    <div className="flex gap-3">
                      {user?.email === "garainpuja53@gmail.com" && (
                        <button
                          onClick={() => {
                            setPaymentModalOpen(false);
                            setPaymentSuccess(false);
                            setAdminModalOpen(true);
                          }}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                        >
                          Open Admin Dashboard
                        </button>
                      )}
                      <button
                        onClick={() => setPaymentSuccess(false)}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
                      >
                        Submit Another
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between py-6">
                    <div className="flex flex-col gap-6">
                      {paymentError && (
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex gap-2 items-start">
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <span>{paymentError}</span>
                        </div>
                      )}

                      <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-3">
                        <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-[11px] leading-relaxed">
                          <strong className="font-bold block">How to claim credits?</strong>
                          1. Scan the QR code with GPay, PhonePe, Paytm, or any banking app.<br />
                          2. Transfer the exact amount ({pricing.formattedPrice}).<br />
                          3. Fill the Transaction ID / UTR number below (only numbers allowed) to instantly add <strong>2,000 credits</strong>.
                        </div>

                        <div className="flex flex-col gap-1.5 mt-2">
                          <label className="text-xs font-bold text-slate-700">Transaction ID / UTR Number</label>
                          <div className="relative">
                            <CreditCard className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              required
                              placeholder="e.g. 415392810248 (numbers only)"
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value.replace(/\D/g, ""))}
                              className="w-full bg-white border border-slate-200 rounded-xl pl-9.5 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors shadow-2xs"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={paymentLoading}
                          className="mt-1.5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {paymentLoading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                          <span>Submit Payment for Review</span>
                        </button>
                      </form>
                    </div>

                    {/* Transaction History Logs */}
                    {user && user.transactions && user.transactions.length > 0 && (
                      <div className="flex flex-col gap-2 mt-6">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <History className="w-3 h-3" />
                          <span>Recent Credit Ledger</span>
                        </span>
                        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-[140px] overflow-y-auto shadow-3xs">
                          {user.transactions.slice().reverse().map((tx: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center px-4 py-2.5 text-xs">
                              <div>
                                <span className="font-semibold text-slate-700 block flex items-center gap-1.5">
                                  <span>
                                    {tx.type === "payment" ? "Credit Top-Up" : tx.type === "signup" ? "Welcome Bonus" : "Transcription"}
                                  </span>
                                  {tx.type === "payment" && (
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wide border ${
                                      tx.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-100" :
                                      tx.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-100" :
                                      "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    }`}>
                                      {tx.status || "approved"}
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {tx.timestamp ? new Date(tx.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : ""}
                                </span>
                              </div>
                              <span className={`font-mono font-bold ${tx.amount > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                                {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Dedicated Admin Dashboard Modal */}
      <AnimatePresence>
        {adminModalOpen && user?.email === "garainpuja53@gmail.com" && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold tracking-tight">VoxScribe Administrator Control Panel</h3>
                    <p className="text-slate-400 text-[11px] font-medium mt-0.5">Secure manual payments review, transaction ledgers, and credit allocation</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAdminModalOpen(false);
                    setAdminSearchQuery("");
                    setAdminFilterStatus("all");
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stats Section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 bg-slate-50 border-b border-slate-200">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Review</span>
                    <span className="text-xl font-bold text-slate-800">
                      {paymentReviews.filter(r => r.status === "pending").length}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approved Total</span>
                    <span className="text-xl font-bold text-slate-800">
                      {paymentReviews.filter(r => r.status === "approved").length}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Submissions</span>
                    <span className="text-xl font-bold text-slate-800">
                      {paymentReviews.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Filtering & Searching Controls */}
              <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by User Email or UTR ID..."
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap hidden md:inline">Filter Status:</span>
                  <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
                    {(["all", "pending", "approved", "rejected"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setAdminFilterStatus(status)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider transition-all flex-1 sm:flex-initial ${
                          adminFilterStatus === status
                            ? "bg-white text-indigo-600 shadow-2xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reviews Lists Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                {(() => {
                  const filtered = paymentReviews.filter((r) => {
                    const matchesSearch =
                      r.userEmail.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
                      r.referenceId.toLowerCase().includes(adminSearchQuery.toLowerCase());
                    const matchesStatus =
                      adminFilterStatus === "all" ? true : r.status === adminFilterStatus;
                    return matchesSearch && matchesStatus;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                        <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-slate-700">No payment records found</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                          There are no transaction records matching the current filters or search queries.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col gap-3">
                      {filtered.map((review) => (
                        <div
                          key={review.txId}
                          className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex flex-col gap-1 max-w-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                                {review.userEmail}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                  review.status === "pending"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : review.status === "rejected"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                {review.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
                              <div>
                                <span className="font-semibold text-slate-400">UTR / Ref ID:</span>{" "}
                                <span className="font-mono font-bold text-slate-700 break-all">{review.referenceId}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-400">Amount Paid:</span>{" "}
                                <span className="font-bold text-slate-800">
                                  {review.amountPaid} {review.currency || "USD"}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-400">Submitted:</span>{" "}
                                <span className="text-slate-600">
                                  {review.timestamp ? new Date(review.timestamp).toLocaleString() : "Unknown date"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {review.status === "pending" && (
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => handleApproveReview(review.userEmail, review.txId)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve Payment</span>
                              </button>
                              <button
                                onClick={() => handleRejectReview(review.userEmail, review.txId)}
                                className="px-4 py-2 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  Administrator Session Secure
                </span>
                <button
                  onClick={() => {
                    setAdminModalOpen(false);
                    setAdminSearchQuery("");
                    setAdminFilterStatus("all");
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Close Panel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
