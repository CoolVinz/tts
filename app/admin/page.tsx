"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Owner {
  id: number;
  name: string;
  display_name: string;
}

export default function AdminPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    fetchOwners();
  }, []);

  const fetchOwners = async () => {
    const { data, error } = await supabase
      .from("owners")
      .select("*")
      .order("id", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setOwners(data as Owner[]);
  };

  const handleAddOwner = async () => {
    if (!/^[a-z0-9_]+$/.test(name)) {
      alert("Name must be lowercase letters, numbers, or underscores only.");
      return;
    }
    if (!name || !displayName) {
      alert("Please fill in both fields.");
      return;
    }
    const { error } = await supabase.from("owners").insert({
      name,
      display_name: displayName,
    });
    if (error) {
      console.error(error);
      alert("Error adding owner.");
      return;
    }
    alert("Owner added!");
    setName("");
    setDisplayName("");
    fetchOwners();
  };

  const handleDeleteOwner = async (id: number) => {
    const confirmDelete = confirm(
      "Are you sure you want to delete this owner?"
    );
    if (!confirmDelete) return;

    // 🔥 (Bonus: เช็คก่อนลบ ว่า owner นี้มีไฟล์เสียงหรือยัง - ไว้ต่อยอดได้)
    const { error } = await supabase.from("owners").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("Error deleting owner.");
      return;
    }
    alert("Owner deleted!");
    fetchOwners();
  };

  return (
    <div className="flex flex-col items-center gap-6 p-10">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <div className="flex flex-col gap-2 border p-6 rounded-lg w-96">
        <h2 className="text-xl font-semibold">Add New Owner</h2>
        <input
          type="text"
          placeholder="Owner Name (e.g., paween)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2"
        />
        <input
          type="text"
          placeholder="Display Name (e.g., Paween)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="border p-2"
        />
        <button
          onClick={handleAddOwner}
          className="bg-green-500 text-white p-2 rounded"
        >
          Save Owner
        </button>
      </div>

      <div className="w-2/3">
        <h2 className="text-2xl font-bold mb-4">Voice Owners</h2>
        <table className="min-w-full border">
          <thead>
            <tr className="border">
              <th className="border p-2">ID</th>
              <th className="border p-2">Name</th>
              <th className="border p-2">Display Name</th>
              <th className="border p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((owner) => (
              <tr key={owner.id} className="border">
                <td className="border p-2">{owner.id}</td>
                <td className="border p-2">{owner.name}</td>
                <td className="border p-2">{owner.display_name}</td>
                <td className="border p-2">
                  <button
                    onClick={() => handleDeleteOwner(owner.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
