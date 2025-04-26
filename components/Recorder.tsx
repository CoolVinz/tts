"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface Owner {
  id: number;
  name: string;
  display_name: string;
}

interface Sentence {
  id: number;
  text: string;
}

export default function Recorder() {
  const searchParams = useSearchParams();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [voiceOwner, setVoiceOwner] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [recordedSentenceIds, setRecordedSentenceIds] = useState<number[]>([]);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("Ready to Record");
  const [statusColor, setStatusColor] = useState<string>("text-gray-500");
  const [recordTimer, setRecordTimer] = useState<number>(0);
  const [recordIntervalId, setRecordIntervalId] =
    useState<NodeJS.Timeout | null>(null);
  const [durations, setDurations] = useState<{ [sentenceId: number]: number }>(
    {}
  );

  const progressPercent =
    (recordedSentenceIds.length / (sentences.length || 1)) * 100;
  const isAlreadyRecorded = recordedSentenceIds.includes(
    sentences[currentIndex]?.id
  );

  useEffect(() => {
    async function fetchData() {
      const { data: ownerData } = await supabase.from("owners").select("*");
      const { data: sentenceData } = await supabase
        .from("sentences")
        .select("*");

      if (ownerData) {
        setOwners(ownerData);
        setVoiceOwner(searchParams.get("owner") || ownerData[0].name);
      }
      if (sentenceData) {
        setSentences(sentenceData);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchRecordedAndDurations() {
      if (!voiceOwner) return;

      const { data: recordedData } = await supabase
        .from("recordings")
        .select("sentence_id")
        .eq("owner", voiceOwner);

      if (recordedData) {
        setRecordedSentenceIds(recordedData.map((item) => item.sentence_id));
      }

      const { data: durationData } = await supabase
        .from("recordings")
        .select("sentence_id, storage_url")
        .eq("owner", voiceOwner);

      if (durationData) {
        const tempDurations: { [sentenceId: number]: number } = {};
        await Promise.all(
          durationData.map(async (item) => {
            try {
              const audio = new Audio(item.storage_url + "?v=" + Math.random());
              await new Promise<void>((resolve) => {
                audio.addEventListener("loadedmetadata", () => {
                  if (!isNaN(audio.duration) && isFinite(audio.duration)) {
                    tempDurations[item.sentence_id] = audio.duration;
                  }
                  resolve();
                });
              });
            } catch (err) {
              console.error("Error loading audio metadata:", err);
            }
          })
        );
        setDurations(tempDurations);
      }
    }

    fetchRecordedAndDurations();
  }, [voiceOwner]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    let chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      setRecordedBlob(new Blob(chunks, { type: "audio/webm" }));
      setIsRecording(false);
      setSaveSuccess(false);
      setStatusText("Recording done. Please Save.");
      setStatusColor("text-yellow-500");
      if (recordIntervalId) clearInterval(recordIntervalId);
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
    setStatusText("Recording...");
    setStatusColor("text-red-500");

    setRecordTimer(0);
    const interval = setInterval(() => {
      setRecordTimer((prev) => prev + 1);
    }, 1000);
    setRecordIntervalId(interval);
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    if (recordIntervalId) clearInterval(recordIntervalId);
  };

  const playNewRecording = () => {
    if (recordedBlob) {
      const audioUrl = URL.createObjectURL(recordedBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const playOldRecording = async () => {
    const sentence = sentences[currentIndex];
    const filename = sentence.id.toString().padStart(4, "0") + ".webm";
    const { data } = supabase.storage
      .from("recordings")
      .getPublicUrl(`${voiceOwner}/${filename}`);
    if (data?.publicUrl) {
      const audio = new Audio(data.publicUrl + "?v=" + Math.random());
      audio.play();
    }
  };

  const saveRecording = async () => {
    if (!recordedBlob) {
      alert("No recording to save!");
      return;
    }
    setIsSaving(true);

    try {
      const sentence = sentences[currentIndex];
      const filename = sentence.id.toString().padStart(4, "0") + ".webm";
      const path = `${voiceOwner}/${filename}`;

      if (recordedSentenceIds.includes(sentence.id)) {
        const confirmReplace = confirm(
          "❗This sentence already has a voice. Do you want to replace it?"
        );
        if (!confirmReplace) {
          setIsSaving(false);
          return;
        }

        const { error: deleteError } = await supabase.storage
          .from("recordings")
          .remove([path]);
        if (deleteError) {
          console.error("Error deleting old file:", deleteError);
          throw deleteError;
        }

        const { error: dbDeleteError } = await supabase
          .from("recordings")
          .delete()
          .eq("owner", voiceOwner)
          .eq("sentence_id", sentence.id);

        if (dbDeleteError) {
          console.error("Error deleting old recording row:", dbDeleteError);
          throw dbDeleteError;
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(path, recordedBlob, {
          cacheControl: "0",
          upsert: true,
          contentType: "audio/webm",
        });
      if (uploadError) throw uploadError;

      const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recordings/${path}`;

      const { error: insertError } = await supabase.from("recordings").upsert({
        owner: voiceOwner,
        filename,
        sentence_id: sentence.id,
        sentence: sentence.text,
        storage_url: storageUrl,
      });
      if (insertError) throw insertError;

      setRecordedSentenceIds((prev) =>
        prev.includes(sentence.id) ? [...prev] : [...prev, sentence.id]
      );

      setSaveSuccess(true);
      setRecordedBlob(null);
      setStatusText("Saved successfully! ✅ Ready to Next.");
      setStatusColor("text-green-500");
      alert("✅ Saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Error saving recording!");
    } finally {
      setIsSaving(false);
    }
  };

  const moveToNextSentence = () => {
    if (isSaving) return alert("Saving... Please wait.");
    if (recordedBlob && !saveSuccess)
      return alert("Please save before moving.");
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetRecordingState();
    }
  };

  const moveToPrevSentence = () => {
    if (isSaving) return alert("Saving... Please wait.");
    if (recordedBlob && !saveSuccess)
      return alert("Please save before moving.");
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetRecordingState();
    }
  };

  const jumpToSentence = (value: number) => {
    if (value >= 1 && value <= sentences.length) {
      setCurrentIndex(value - 1);
      resetRecordingState();
    }
  };

  const resetRecordingState = () => {
    setRecordedBlob(null);
    setSaveSuccess(false);
    setStatusText("Ready to Record");
    setStatusColor("text-gray-500");
    setRecordTimer(0);
    if (recordIntervalId) clearInterval(recordIntervalId);
  };

  function renderButton(
    label: string,
    onClick: () => void,
    disabled: boolean,
    activeClasses: string
  ) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`font-bold py-2 px-6 rounded ${
          disabled
            ? "bg-gray-400 text-white cursor-not-allowed"
            : activeClasses + " text-white"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-5xl mx-auto">
      {/* Progress bar */}
      <div className="w-full bg-gray-300 rounded-full h-6 overflow-hidden">
        <div
          className="bg-green-500 h-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="text-center font-semibold">
        {progressPercent.toFixed(1)}% Completed
      </div>

      {/* Owner selector */}
      <div className="flex flex-col items-center gap-2">
        <label className="font-semibold">Select Voice Owner:</label>
        <select
          value={voiceOwner}
          onChange={(e) => setVoiceOwner(e.target.value)}
          className="border p-2 rounded-lg"
        >
          {owners.map((owner) => (
            <option key={owner.id} value={owner.name}>
              {owner.display_name}
            </option>
          ))}
        </select>
      </div>

      {/* Jump */}
      <div className="flex items-center gap-2">
        <label className="font-semibold">Jump to:</label>
        <input
          type="number"
          min="1"
          max={sentences.length}
          value={currentIndex + 1}
          onChange={(e) => jumpToSentence(parseInt(e.target.value))}
          className="border p-2 rounded-lg w-24 text-center"
        />
        <span className="text-sm text-gray-500">(1 - {sentences.length})</span>
      </div>

      {/* Current sentence */}
      <div className="text-3xl font-bold text-center">
        {sentences[currentIndex]?.text}
      </div>

      {/* Sentence status */}
      <div
        className={`font-semibold text-lg ${
          isAlreadyRecorded ? "text-green-600" : "text-red-500"
        }`}
      >
        {isAlreadyRecorded ? "✅ Already recorded" : "❌ Not recorded yet"}
      </div>

      {/* Timer */}
      <div className="flex flex-col items-center gap-1">
        {isRecording && (
          <div className="text-red-600 font-semibold">
            ⏺ Recording: {recordTimer}s
          </div>
        )}
        {!isRecording && durations[sentences[currentIndex]?.id] && (
          <div className="text-green-600 font-semibold">
            ⏱ Duration: {durations[sentences[currentIndex].id].toFixed(1)}s
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {renderButton(
          "🎙 Start",
          startRecording,
          isRecording,
          "bg-green-500 hover:bg-green-600"
        )}
        {renderButton(
          "🛑 Stop",
          stopRecording,
          !isRecording,
          "bg-red-500 hover:bg-red-600"
        )}
        {renderButton(
          "▶️ Play New",
          playNewRecording,
          !recordedBlob,
          "bg-blue-500 hover:bg-blue-600"
        )}
        {renderButton(
          "🕑 Play Old",
          playOldRecording,
          !isAlreadyRecorded,
          "bg-yellow-400 hover:bg-yellow-500 text-black"
        )}
        {renderButton(
          "💾 Save",
          saveRecording,
          !recordedBlob,
          "bg-indigo-500 hover:bg-indigo-600"
        )}
        {renderButton(
          "⏮ Prev",
          moveToPrevSentence,
          currentIndex === 0,
          "bg-gray-500 hover:bg-gray-600"
        )}
        {renderButton(
          "⏭ Next",
          moveToNextSentence,
          false,
          "bg-gray-600 hover:bg-gray-700"
        )}
      </div>
    </div>
  );
}
