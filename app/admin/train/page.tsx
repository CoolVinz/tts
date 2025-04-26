"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Owner {
  id: number;
  name: string;
  display_name: string;
}

export default function TrainPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [isTraining, setIsTraining] = useState(false);

  useEffect(() => {
    async function fetchOwners() {
      const { data, error } = await supabase.from("owners").select("*");

      if (error) {
        console.error("Error fetching owners:", error);
      }
      if (data) {
        setOwners(data);
        setSelectedOwner(data[0]?.name || "");
      }
    }

    fetchOwners();
  }, []);

  const startTraining = async () => {
    if (!selectedOwner) {
      alert("Please select an owner to train!");
      return;
    }

    setLogs([]);
    setIsTraining(true);

    const response = await fetch("/api/train", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: selectedOwner }),
    });

    if (!response.ok) {
      console.error("Failed to start training.");
      alert("Error starting training.");
      setIsTraining(false);
      return;
    }

    const { logs: newLogs } = await response.json();

    for (const log of newLogs) {
      setLogs((prev) => [...prev, log]);
      await new Promise((resolve) => setTimeout(resolve, 500)); // simulate realtime log
    }

    setIsTraining(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">
        🤖 Train TTS Model Interface
      </h1>

      <div className="flex flex-col items-center gap-4">
        {/* Owner Selector */}
        <div className="flex flex-col items-center">
          <label htmlFor="owner" className="font-semibold mb-2">
            Select Owner:
          </label>
          <select
            id="owner"
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="border p-2 rounded-lg"
          >
            {owners.map((owner) => (
              <option key={owner.id} value={owner.name}>
                {owner.display_name}
              </option>
            ))}
          </select>
        </div>

        {/* Start Button */}
        <button
          onClick={startTraining}
          disabled={isTraining}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded disabled:bg-green-300"
        >
          {isTraining ? "Training..." : "🚀 Start Training"}
        </button>

        {/* Log Display */}
        <div className="mt-6 w-full max-w-2xl bg-gray-100 rounded-lg p-4 h-64 overflow-y-auto">
          <h2 className="text-lg font-bold mb-2">📜 Training Logs:</h2>
          {logs.length === 0 ? (
            <div className="text-gray-400">No logs yet...</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="text-sm text-gray-800">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
