import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface GrasrotYearlyRow {
  year: number;
  amount_nok: number;
  num_supporters: number;
  is_confirmed: boolean;
  source_note: string | null;
  updated_at: string;
}

interface GrasrotFetchStatus {
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
}

interface GrasrotDirectData {
  yearlyData: GrasrotYearlyRow[];
  fetchStatus: GrasrotFetchStatus | null;
  currentYearData: GrasrotYearlyRow | null;
  previousYears: GrasrotYearlyRow[];
}

export const useGrasrotDirect = () => {
  return useQuery({
    queryKey: ["grasrot-direct"],
    queryFn: async (): Promise<GrasrotDirectData> => {
      // Fetch yearly data
      const { data: yearlyData, error: yearlyError } = await supabase
        .from("grasrot_yearly")
        .select("year, amount_nok, num_supporters, is_confirmed, source_note, updated_at")
        .order("year", { ascending: true });

      if (yearlyError) {
        console.error("[useGrasrotDirect] Error fetching yearly data:", yearlyError);
        throw yearlyError;
      }

      // Fetch status - handle case where table might not exist yet
      let fetchStatus: GrasrotFetchStatus | null = null;
      try {
        const { data: statusData, error: statusError } = await supabase
          .from("grasrot_fetch_status")
          .select("last_success_at, last_attempt_at, last_error")
          .eq("id", 1)
          .single();

        if (!statusError && statusData) {
          fetchStatus = statusData;
        }
      } catch (e) {
        console.warn("[useGrasrotDirect] Could not fetch status (table may not exist):", e);
      }

      const currentYear = new Date().getFullYear();
      const typedData: GrasrotYearlyRow[] = (yearlyData || []).map(row => ({
        year: row.year,
        amount_nok: typeof row.amount_nok === 'string' ? parseFloat(row.amount_nok) : row.amount_nok,
        num_supporters: row.num_supporters ?? 0,
        is_confirmed: row.is_confirmed,
        source_note: row.source_note,
        updated_at: row.updated_at,
      }));

      const currentYearData = typedData.find(d => d.year === currentYear) || null;
      const previousYears = typedData.filter(d => d.year < currentYear).sort((a, b) => b.year - a.year).slice(0, 5);

      return {
        yearlyData: typedData,
        fetchStatus,
        currentYearData,
        previousYears,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
  });
};

/**
 * Formaterer beløp til norsk valutaformat
 */
export const formatNOK = (amount: number): string => {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Formaterer beløp med desimaler til norsk valutaformat
 */
export const formatNOKWithDecimals = (amount: number): string => {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};
