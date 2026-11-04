import { create } from "zustand";
import { getRange, shiftAnchor, todayISO, type RangeType } from "./dates";

type PeriodState = {
  range: RangeType;
  anchor: string;
  label: string;
  setRange: (r: RangeType) => void;
  openMonth: (date:string) => void;
  prev: () => void;
  next: () => void;
};

const today = todayISO();

export const usePeriod = create<PeriodState>((set) => ({
  range: "month",
  anchor: today,
  label: getRange("month", today).label,
  openMonth: anchor => set({range:"month",anchor,label:getRange("month",anchor).label}),
  setRange: (range) => set((s) => ({ range, label: getRange(range, s.anchor).label })),
  prev: () =>
    set((s) => {
      const anchor = shiftAnchor(s.range, s.anchor, -1);
      return { anchor, label: getRange(s.range, anchor).label };
    }),
  next: () =>
    set((s) => {
      const anchor = shiftAnchor(s.range, s.anchor, 1);
      return { anchor, label: getRange(s.range, anchor).label };
    }),
}));
