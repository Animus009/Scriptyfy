import React, { useState, useEffect } from "react";
import { SubtitleSegment } from "../types";
import { formatTime, parseTimeToSeconds } from "../utils";
import { Play, Trash2 } from "lucide-react";

interface SegmentRowProps {
  segment: SubtitleSegment;
  index: number;
  isActive: boolean;
  onUpdate: (id: string, updated: Partial<SubtitleSegment>) => void;
  onDelete: (id: string) => void;
  onPlaySegment: (start: number, end: number) => void;
}

export const SegmentRow: React.FC<SegmentRowProps> = ({
  segment,
  index,
  isActive,
  onUpdate,
  onDelete,
  onPlaySegment,
}) => {
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [textInput, setTextInput] = useState("");

  // Keep local input state synced with props, unless focused
  useEffect(() => {
    setStartTimeInput(formatTime(segment.start).replace(",", "."));
  }, [segment.start]);

  useEffect(() => {
    setEndTimeInput(formatTime(segment.end).replace(",", "."));
  }, [segment.end]);

  useEffect(() => {
    setTextInput(segment.text);
  }, [segment.text]);

  const handleStartBlur = () => {
    const seconds = parseTimeToSeconds(startTimeInput);
    if (!isNaN(seconds) && seconds >= 0 && seconds <= segment.end) {
      onUpdate(segment.id, { start: seconds });
    } else {
      setStartTimeInput(formatTime(segment.start).replace(",", "."));
    }
  };

  const handleEndBlur = () => {
    const seconds = parseTimeToSeconds(endTimeInput);
    if (!isNaN(seconds) && seconds >= segment.start) {
      onUpdate(segment.id, { end: seconds });
    } else {
      setEndTimeInput(formatTime(segment.end).replace(",", "."));
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextInput(e.target.value);
    onUpdate(segment.id, { text: e.target.value });
  };

  return (
    <div
      id={`segment-row-${segment.id}`}
      className={`grid grid-cols-1 md:grid-cols-[170px,1fr] group transition-all duration-300 ${
        isActive
          ? "bg-indigo-50/40"
          : "hover:bg-slate-50/40 bg-white"
      }`}
    >
      {/* Left Timestamp & Index Block */}
      <div 
        className={`p-4 flex flex-row md:flex-col items-center justify-between md:justify-center gap-2 border-b md:border-b-0 md:border-r border-slate-100 font-mono text-xs select-none ${
          isActive ? "bg-indigo-50/50 text-indigo-700" : "text-slate-500 bg-slate-50/20"
        }`}
      >
        {/* Row Index */}
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            isActive ? "bg-indigo-600 text-white" : "bg-slate-200/80 text-slate-600"
          }`}>
            #{index + 1}
          </span>
          <button
            onClick={() => onPlaySegment(segment.start, segment.end)}
            title="Play segment"
            className={`p-1 rounded-md transition-colors ${
              isActive ? "bg-indigo-100 hover:bg-indigo-200 text-indigo-700" : "bg-slate-100 hover:bg-slate-200 text-slate-500"
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
          </button>
        </div>

        {/* Start / End Time Inputs */}
        <div className="flex items-center md:flex-col gap-1 text-[11px]">
          <input
            type="text"
            value={startTimeInput}
            onChange={(e) => setStartTimeInput(e.target.value)}
            onBlur={handleStartBlur}
            title="Edit start time"
            className="w-20 text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none p-0.5 transition-colors font-medium text-slate-700"
          />
          <span className="text-slate-300 text-[10px] md:my-0.5">to</span>
          <input
            type="text"
            value={endTimeInput}
            onChange={(e) => setEndTimeInput(e.target.value)}
            onBlur={handleEndBlur}
            title="Edit end time"
            className="w-20 text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none p-0.5 transition-colors font-medium text-slate-700"
          />
        </div>
      </div>

      {/* Right Transcript Text Body & Options Block */}
      <div className="p-4 flex gap-3 items-start relative">
        <div className="flex-1">
          <textarea
            value={textInput}
            onChange={handleTextChange}
            placeholder="No subtitle content for this segment..."
            rows={2}
            className="w-full text-sm text-slate-700 bg-transparent border-none focus:ring-0 resize-none leading-relaxed focus:outline-none p-0 placeholder-slate-400"
          />
        </div>

        {/* Delete Row button */}
        <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => onDelete(segment.id)}
            title="Delete segment"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

