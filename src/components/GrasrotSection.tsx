import { Heart, ExternalLink, Info, ChevronDown } from "lucide-react";
import { useGrasrotDirect, formatNOK, formatNOKWithDecimals } from "@/hooks/useGrasrotDirect";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { useState } from "react";

const GRASROT_SOURCE_URL = "https://www.norsk-tipping.no/grasrotandelen/statistikk/iframe/996145530";

const chartConfig = {
  amount: {
    label: "Beløp (kr)",
    color: "hsl(var(--primary))",
  },
  supporters: {
    label: "Grasrotgivere",
    color: "hsl(var(--secondary))",
  },
};

const GrasrotSection = () => {
  const { data, isLoading, error } = useGrasrotDirect();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const isMobile = useIsMobile();

  const formatLastUpdated = (dateString: string | null): string => {
    if (!dateString) return "Ukjent";
    try {
      return format(new Date(dateString), "d. MMMM yyyy", { locale: nb });
    } catch {
      return "Ukjent";
    }
  };

  const getLastUpdated = (): string | null => {
    if (data?.fetchStatus?.last_success_at) return data.fetchStatus.last_success_at;
    if (data?.yearlyData && data.yearlyData.length > 0) {
      return data.yearlyData[data.yearlyData.length - 1].updated_at;
    }
    return null;
  };

  // Chart: last 5 completed years (exclude current year)
  const lastCompletedYear = currentYear - 1;
  const chartData = data?.yearlyData
    ?.filter(d => d.amount_nok > 0 && d.year <= lastCompletedYear)
    .sort((a, b) => a.year - b.year)
    .slice(-5)
    .map(d => ({
      year: d.year.toString(),
      amount: Math.round(d.amount_nok),
      supporters: d.num_supporters || 0,
    })) || [];

  // Selected year data
  const selectedYearData = data?.yearlyData?.find(d => d.year === parseInt(selectedYear));
  const allYears = data?.yearlyData
    ?.filter(d => d.amount_nok > 0)
    .sort((a, b) => b.year - a.year) || [];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.dataKey === 'amount' ? 'Beløp' : 'Givere'}:</span>
            <span className="font-medium">
              {entry.dataKey === 'amount'
                ? new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(entry.value)
                : entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <section className="py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-xl md:text-2xl">Grasrotandelen</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Grasrotandelen er en ordning fra Norsk Tipping som lar deg støtte klubben
              uten ekstra kostnad. 7% av innsatsen din går direkte til oss.
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : error ? (
              <div className="text-center py-6">
                <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  Kunne ikke hente Grasrotandelen-data akkurat nå.
                </p>
                <a
                  href={GRASROT_SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-3"
                >
                  <span>Se statistikk hos Norsk Tipping</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : !data?.yearlyData || data.yearlyData.length === 0 ? (
              <div className="text-center py-6 bg-muted/30 rounded-lg">
                <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground font-medium">
                  Grasrotandelen oppdateres snart
                </p>
              </div>
            ) : (
              <>
                {/* Year selector + summary */}
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-[140px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allYears.map(d => (
                          <SelectItem key={d.year} value={d.year.toString()}>
                            {d.year}{d.year === currentYear ? " (i år)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-right">
                      <span className="text-2xl sm:text-3xl font-bold text-primary block">
                        {selectedYearData
                          ? formatNOKWithDecimals(selectedYearData.amount_nok)
                          : "—"}
                      </span>
                      {selectedYearData && selectedYearData.num_supporters > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {selectedYearData.num_supporters} grasrotgivere
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Line chart – dual axis */}
                {chartData.length > 1 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                      Utvikling over tid
                    </h4>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                        <span>Beløp (kr)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-secondary" />
                        <span>Grasrotgivere</span>
                      </div>
                    </div>

                    <ChartContainer config={chartConfig} className="aspect-[3/1] w-full max-h-[180px]">
                      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                        <XAxis
                          dataKey="year"
                          tickLine={false}
                          axisLine={false}
                          className="text-xs fill-muted-foreground"
                          interval={0}
                        />
                        <YAxis
                          yAxisId="amount"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                          className="text-xs fill-muted-foreground"
                          width={44}
                          domain={[(dataMin: number) => Math.floor(dataMin / 1000) * 1000, 'dataMax']}
                          tickCount={5}
                        />
                        <YAxis
                          yAxisId="supporters"
                          orientation="right"
                          tickLine={false}
                          axisLine={false}
                          className="text-xs fill-muted-foreground"
                          width={28}
                          domain={[(dataMin: number) => Math.max(0, dataMin - 10), 'auto']}
                          tickCount={4}
                        />
                        <ChartTooltip content={<CustomTooltip />} />
                        <Line
                          yAxisId="amount"
                          type="monotone"
                          dataKey="amount"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "hsl(var(--primary))" }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          yAxisId="supporters"
                          type="monotone"
                          dataKey="supporters"
                          stroke="hsl(var(--secondary))"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "hsl(var(--secondary))" }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ChartContainer>
                  </div>
                )}

                {/* Sist oppdatert */}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Sist oppdatert: {formatLastUpdated(getLastUpdated())}
                </p>
              </>
            )}

            {/* Lenke til Norsk Tipping */}
            <div className="pt-2 border-t border-border/50">
              <a
                href="https://www.norsk-tipping.no/grasrotandelen"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline transition-colors"
              >
                <span>Les mer om Grasrotandelen</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default GrasrotSection;
