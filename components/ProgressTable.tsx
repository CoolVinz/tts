"use client";

import Link from "next/link";

interface ProgressTableProps {
  progressData: {
    owner: string;
    recordedCount: number;
    totalSentences: number;
    percent: number;
  }[];
}

export default function ProgressTable({ progressData }: ProgressTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-auto border-collapse border">
        <thead>
          <tr className="bg-gray-200 dark:bg-gray-700">
            <th className="border p-2">Owner</th>
            <th className="border p-2">Recorded</th>
            <th className="border p-2">Total</th>
            <th className="border p-2">Progress</th>
            <th className="border p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {progressData.map((item) => (
            <tr
              key={item.owner}
              className="text-center hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <td className="border p-2">{item.owner}</td>
              <td className="border p-2">{item.recordedCount}</td>
              <td className="border p-2">{item.totalSentences}</td>
              <td className="border p-2">{item.percent.toFixed(1)}%</td>
              <td className="border p-2">
                <Link
                  href={`/recorder?owner=${encodeURIComponent(item.owner)}`}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                >
                  Go Record
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
