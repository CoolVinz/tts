"use client";

import { useEffect, useState } from "react";
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
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voiceOwner, setVoiceOwner] = useState<string>("");
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: sentenceData, error: sentenceError } = await supabase
        .from("sentences")
        .select("*")
        .order("id", { ascending: true });

      if (sentenceError) {
        console.error(sentenceError);
        return;
      }
      setSentences(sentenceData as Sentence[]);

      const { data: ownerData, error: ownerError } = await supabase
        .from("owners")
        .select("*")
        .order("id", { ascending: true });

      if (ownerError) {
        console.error(ownerError);
        return;
      }
      setOwners(ownerData as Owner[]);

      // ตั้ง owner default เป็นตัวแรก
      if (ownerData && ownerData.length > 0) {
        setVoiceOwner(ownerData[0].name);
      }
    }

    fetchData();
  }, []);

  if (sentences.length === 0 || owners.length === 0)
    return <div>Loading...</div>;

  // 🎯 ฟังก์ชัน Validate Owner Name (Clean Name Check)
  const validateOwnerName = (name: string) => /^[a-z0-9_]+$/.test(name);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recorder.start();
    setAudioChunks([]);

    recorder.addEventListener("dataavailable", (event) => {
      setAudioChunks((prev) => [...prev, event.data]);
    });

    recorder.addEventListener("stop", () => {
      const blob = new Blob(audioChunks, { type: "audio/wav" });
      setRecordedBlob(blob);
    });

    setMediaRecorder(recorder);
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
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
    const filename = sentence.id.toString().padStart(4, "0") + ".wav";
    const { data } = await supabase.storage
      .from("recordings")
      .getPublicUrl(`${voiceOwner}/${filename}`);

    if (data?.publicUrl) {
      const audio = new Audio(data.publicUrl);
      audio.play();
    }
  };

  const saveRecording = async () => {
    if (!recordedBlob) return;
    if (!validateOwnerName(voiceOwner)) {
      alert(
        "Owner name invalid. Only lowercase letters, numbers, and underscore allowed."
      );
      return;
    }

    const sentence = sentences[currentIndex];
    const filename = sentence.id.toString().padStart(4, "0") + ".wav";
    const filePath = `${voiceOwner}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("recordings")
      .upload(filePath, recordedBlob, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError);
      alert("Error uploading file.");
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
      console.error(insertError);
      alert("Error saving metadata.");
      return;
    }

    alert("Recording saved successfully!");
  };

  const nextSentence = () => {
    if (currentIndex < sentences.length - 1) {
      setRecordedBlob(null);
      setCurrentIndex(currentIndex + 1);
    } else {
      alert("All sentences are completed!");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">Thai TTS Voice Recorder</h1>

      <div>
        <label htmlFor="owner">Select Voice Owner: </label>
        <select
          id="owner"
          value={voiceOwner}
          onChange={(e) => setVoiceOwner(e.target.value)}
          className="border p-2"
        >
          {owners.map((owner) => (
            <option key={owner.id} value={owner.name}>
              {owner.display_name}
            </option>
          ))}
        </select>
      </div>

      <div className="text-xl font-semibold">
        {sentences[currentIndex].text}
      </div>

      <div className="flex gap-2">
        <button onClick={startRecording} className="bg-green-500 p-2 rounded">
          Start
        </button>
        <button onClick={stopRecording} className="bg-red-500 p-2 rounded">
          Stop
        </button>
        <button
          onClick={playNewRecording}
          disabled={!recordedBlob}
          className="bg-blue-500 p-2 rounded"
        >
          Play New
        </button>
        <button
          onClick={playOldRecording}
          className="bg-yellow-500 p-2 rounded"
        >
          Play Old
        </button>
        <button
          onClick={saveRecording}
          disabled={!recordedBlob}
          className="bg-purple-500 p-2 rounded"
        >
          Save
        </button>
        <button onClick={nextSentence} className="bg-gray-500 p-2 rounded">
          Next
        </button>
      </div>

      <div>
        Progress: {currentIndex + 1} / {sentences.length}
      </div>
    </div>
  );
}
