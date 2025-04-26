"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  XAxis,
  YAxis,
  Bar,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";

interface Recording {
  owner: string;
  filename: string;
  sentence: string;
  storage_url: string;
}

export default function DashboardPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [ownerStats, setOwnerStats] = useState<
    { owner: string; count: number }[]
  >([]);

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#A28BE7",
    "#E87461",
    "#76DD6A",
    "#FFA5C9",
    "#00BFA6",
    "#FFD166",
  ];

  useEffect(() => {
    async function fetchRecordings() {
      const { data, error } = await supabase.from("recordings").select("*");

      if (error) {
        console.error("Error fetching recordings:", error);
        alert("Error loading recordings.");
      }

      if (data) {
        setRecordings(data);

        const grouped: Record<string, number> = {};

        data.forEach((rec: Recording) => {
          grouped[rec.owner] = (grouped[rec.owner] || 0) + 1;
        });

        const stats = Object.entries(grouped).map(([owner, count]) => ({
          owner,
          count,
        }));
        setOwnerStats(stats);
      }
    }

    fetchRecordings();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">
        📊 TTS Dataset Dashboard
      </h1>

      {ownerStats.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Pie Chart */}
          <div className="w-full h-96">
            <h2 className="text-center text-lg font-semibold mb-4">
              Percentage by Owner (Pie Chart)
            </h2>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ownerStats}
                  dataKey="count"
                  nameKey="owner"
                  outerRadius={120}
                  fill="#8884d8"
                  label
                >
                  {ownerStats.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div className="w-full h-96">
            <h2 className="text-center text-lg font-semibold mb-4">
              Files Recorded by Owner (Bar Chart)
            </h2>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ownerStats}>
                <XAxis dataKey="owner" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#00C49F" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="text-center mt-10 text-xl">Loading dashboard...</div>
      )}
    </div>
  );
}
