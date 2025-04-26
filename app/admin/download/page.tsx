"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import JSZip from "jszip";
// @ts-ignore
import { saveAs } from "file-saver";

interface Recording {
  id: number;
  owner: string;
  filename: string;
  sentence: string;
  storage_url: string;
}

export default function DownloadPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchRecordings() {
      const { data, error } = await supabase.from("recordings").select("*");
      if (error) {
        console.error("Error fetching recordings:", error);
        alert("Error loading recordings.");
      }
      if (data) {
        setRecordings(data);
      }
    }
    fetchRecordings();
  }, []);

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    const allIds = recordings.map((r) => r.id);
    setSelectedIds(allIds);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const downloadSelected = async () => {
    if (selectedIds.length === 0) {
      alert("No recordings selected.");
      return;
    }

    setLoading(true);

    const zip = new JSZip();
    const selectedRecordings = recordings.filter((r) =>
      selectedIds.includes(r.id)
    );

    for (const rec of selectedRecordings) {
      try {
        const response = await fetch(rec.storage_url);
        if (!response.ok) {
          console.error(`Failed to fetch ${rec.filename}`);
          continue;
        }
        const blob = await response.blob();
        zip.file(`audio/${rec.filename}`, blob);
      } catch (err) {
        console.error("Fetch error:", err);
      }
    }

    // Also include JSON metadata
    const metadataJson = JSON.stringify(selectedRecordings, null, 2);
    zip.file("json/dataset.json", metadataJson);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, "tts_dataset_backup.zip");

    setLoading(false);
  };

  const downloadAll = () => {
    const allIds = recordings.map((r) => r.id);
    setSelectedIds(allIds);
    setTimeout(() => {
      downloadSelected();
    }, 100); // wait a little bit to setSelectedIds first
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">
        🎵 Download TTS Dataset
      </h1>

      <div className="flex gap-4 justify-center mb-6">
        <button
          onClick={selectAll}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          Select All
        </button>
        <button
          onClick={clearSelection}
          className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
        >
          Clear All
        </button>
        <button
          onClick={downloadSelected}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:bg-green-300"
        >
          📦 Download Selected
        </button>
        <button
          onClick={downloadAll}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded disabled:bg-purple-300"
        >
          📦 Download All
        </button>
      </div>

      {loading && (
        <div className="text-center text-lg text-green-600 animate-pulse mb-4">
          Preparing ZIP...
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Select</th>
              <th className="border p-2">Filename</th>
              <th className="border p-2">Sentence</th>
              <th className="border p-2">Owner</th>
            </tr>
          </thead>
          <tbody>
            {recordings.map((rec) => (
              <tr key={rec.id} className="text-center hover:bg-gray-100">
                <td className="border p-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(rec.id)}
                    onChange={() => toggleSelect(rec.id)}
                  />
                </td>
                <td className="border p-2">{rec.filename}</td>
                <td className="border p-2">{rec.sentence}</td>
                <td className="border p-2">{rec.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
