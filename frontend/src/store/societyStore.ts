import { create } from "zustand";

export interface Society {
  id: string;
  name: string;
  shortName: string;
  type: "SOCIETY" | "AFFINITY_GROUP" | "COUNCIL";
  logoUrl?: string;
}

interface SocietyState {
  activeSocietyId: string | null;
  activeSociety: Society | null;
  societies: Society[];
  setActiveSociety: (society: Society) => void;
  setSocieties: (societies: Society[]) => void;
}

export const useSocietyStore = create<SocietyState>((set) => ({
  activeSocietyId: localStorage.getItem("activeSocietyId"),
  activeSociety: null,
  societies: [],
  setActiveSociety: (society) => {
    localStorage.setItem("activeSocietyId", society.id);
    set({ activeSocietyId: society.id, activeSociety: society });
  },
  setSocieties: (societies) => {
    const savedId = localStorage.getItem("activeSocietyId");
    const active = societies.find((s) => s.id === savedId) || societies[0] || null;
    set({ societies, activeSociety: active, activeSocietyId: active?.id || null });
  },
}));
