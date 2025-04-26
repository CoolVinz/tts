"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProgressTable from "@/components/ProgressTable";

export default function AdminPage() {
  const [progressData, setProgressData] = useState<
    {
      owner: string;
      recordedCount: number;
      totalSentences: number;
      percent: number;
    }[]
  >([]);

  useEffect(() => {
    async function fetchProgress() {
      const { data: owners } = await supabase.from("owners").select("*");
      const { data: recordings } = await supabase
        .from("recordings")
        .select("owner");
      const { data: sentences } = await supabase.from("sentences").select("id");

      if (owners && recordings && sentences) {
        const totalSentences = sentences.length;

        const ownerProgress = owners.map((owner) => {
          const ownerRecordings = recordings.filter(
            (r) => r.owner === owner.name
          );
          const recordedCount = ownerRecordings.length;
          const percent = (recordedCount / totalSentences) * 100;

          return {
            owner: owner.name,
            recordedCount,
            totalSentences,
            percent,
          };
        });

        setProgressData(ownerProgress);
      }
    }

    fetchProgress();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">
        🎙️ Admin Progress Overview
      </h1>
      <ProgressTable progressData={progressData} />
    </div>
  );
}
