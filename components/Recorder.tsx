"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [owners, setOwners] = useState<Owner[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [voiceOwner, setVoiceOwner] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSentenceIds, setRecordedSentenceIds] = useState<number[]>([]);

  // ✅ Progress ตามจำนวนไฟล์เสียงจริง
  const progressPercent =
    (recordedSentenceIds.length / (sentences.length || 1)) * 100;

  useEffect(() => {
    async function fetchData() {
      const { data: ownerData } = await supabase.from("owners").select("*");
      const { data: sentenceData } = await supabase
        .from("sentences")
        .select("*");

      if (ownerData && ownerData.length > 0) {
        setOwners(ownerData);

        const ownerParam = searchParams.get("owner");
        if (ownerParam) {
          setVoiceOwner(ownerParam);
        } else {
          setVoiceOwner(ownerData[0].name);
        }
      }

      if (sentenceData && sentenceData.length > 0) {
        setSentences(sentenceData);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    async function fetchRecordedSentences() {
      if (!voiceOwner) return;

      const { data } = await supabase
        .from("recordings")
        .select("sentence_id")
        .eq("owner", voiceOwner);

      if (data) {
        const ids = data.map(
          (item: { sentence_id: number }) => item.sentence_id
        );
        setRecordedSentenceIds(ids);
      }
    }

    fetchRecordedSentences();
  }, [voiceOwner]);

  if (owners.length === 0 || sentences.length === 0) {
    return <div className="text-center mt-10 text-xl">Loading...</div>;
  }

  const isAlreadyRecorded = recordedSentenceIds.includes(
    sentences[currentIndex].id
  );

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    let localAudioChunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        localAudioChunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const audioBlob = new Blob(localAudioChunks, { type: "audio/webm" });
      setRecordedBlob(audioBlob);
      setIsRecording(false);

      await saveRecording(audioBlob);
      moveToNextSentence();
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setIsRecording(false);
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
    const path = `${voiceOwner}/${filename}`;

    const { data } = supabase.storage.from("recordings").getPublicUrl(path);

    if (!data?.publicUrl) {
      console.error("Public URL not found.");
      alert("Cannot find old recording.");
      return;
    }

    const audio = new Audio(data.publicUrl);

    audio.onerror = (e) => {
      console.error("Audio error:", e);
      alert("Failed to load or play audio.");
    };

    audio.play();
  };

  const saveRecording = async (blob: Blob) => {
    const sentence = sentences[currentIndex];
    const filename = sentence.id.toString().padStart(4, "0") + ".webm";
    const filePath = `${voiceOwner}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("recordings")
      .upload(filePath, blob, {
        cacheControl: "3600",
        upsert: true,
        contentType: "audio/webm",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      alert("Error uploading audio.");
      return;
    }

    const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recordings/${filePath}`;

    const { error: insertError } = await supabase.from("recordings").upsert({
      owner: voiceOwner,
      filename: filename,
      sentence_id: sentence.id,
      sentence: sentence.text,
      storage_url: storageUrl,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      alert("Error saving metadata.");
      return;
    }

    setRecordedSentenceIds((prev) => [...prev, sentence.id]);
  };

  const moveToNextSentence = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setRecordedBlob(null);
    } else {
      alert("All sentences completed!");
    }
  };

  const prevSentence = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setRecordedBlob(null);
    } else {
      alert("Already at the first sentence!");
    }
  };

  const jumpToSentence = (value: number) => {
    if (value >= 1 && value <= sentences.length) {
      setCurrentIndex(value - 1);
      setRecordedBlob(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Progress Bar */}
      <div className="w-full max-w-2xl bg-gray-300 rounded-full h-6 overflow-hidden">
        <div
          className="bg-green-500 h-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-2 text-center text-lg font-semibold">
        {progressPercent.toFixed(1)}% Completed
      </div>

      {/* Recording Indicator */}
      {isRecording && (
        <div className="text-red-600 font-bold text-lg animate-pulse">
          Recording... 🎙
        </div>
      )}

      {/* Select Owner */}
      <div className="flex flex-col items-center gap-2">
        <label htmlFor="owner" className="font-semibold">
          Select Voice Owner:
        </label>
        <select
          id="owner"
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

      {/* Jump to Sentence */}
      <div className="flex items-center gap-2">
        <label className="font-semibold">Jump to:</label>
        <input
          type="number"
          min="1"
          max={sentences.length}
          value={currentIndex + 1}
          onChange={(e) => jumpToSentence(parseInt(e.target.value, 10))}
          className="border p-2 rounded-lg w-24 text-center"
        />
        <span className="text-sm text-gray-500">(1 - {sentences.length})</span>
      </div>

      {/* Current Sentence */}
      <div className="text-2xl font-bold text-center">
        {sentences[currentIndex].text}
      </div>

      {/* Current Status */}
      <div className="text-lg font-semibold mt-2">
        Current Status:{" "}
        {isAlreadyRecorded ? (
          <span className="text-green-500">✅ Already recorded</span>
        ) : (
          <span className="text-red-500">❌ Not recorded yet</span>
        )}
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={startRecording}
          className="bg-green-500 text-white px-4 py-2 rounded-lg"
          disabled={isRecording}
        >
          🎙 Start
        </button>
        <button
          onClick={stopRecording}
          className="bg-red-500 text-white px-4 py-2 rounded-lg"
          disabled={!isRecording}
        >
          🛑 Stop
        </button>
        <button
          onClick={playNewRecording}
          disabled={!recordedBlob || !isAlreadyRecorded}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:bg-blue-300"
        >
          ▶️ Play New
        </button>
        <button
          onClick={playOldRecording}
          disabled={!isAlreadyRecorded}
          className="bg-yellow-500 text-black px-4 py-2 rounded-lg disabled:bg-yellow-300"
        >
          🕑 Play Old
        </button>
        <button
          onClick={prevSentence}
          disabled={currentIndex === 0}
          className="bg-gray-500 text-white px-4 py-2 rounded-lg disabled:bg-gray-300"
        >
          ⏮ Prev
        </button>
        <button
          onClick={moveToNextSentence}
          className="bg-gray-500 text-white px-4 py-2 rounded-lg"
        >
          ⏭ Next
        </button>
      </div>
    </div>
  );
}
