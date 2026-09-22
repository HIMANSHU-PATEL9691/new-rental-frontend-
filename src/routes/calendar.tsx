import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/data/store";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrencyINR } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Calendar as CalendarIcon, X, Eye } from "lucide-react";
import * as XLSX from "xlsx";
import { FALLBACK_IMG, formatImageUrl } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const { rentals, getItem, getCustomer, searchQuery, updateRental, updateItem } = useStore();
  const [role, setRole] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRental, setSelectedRental] = useState<typeof rentals[0] | null>(null);
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now;
  });

  const todayStr = today();
  const YEAR = currentDate.getFullYear();
  const MONTH = currentDate.getMonth();
  const MONTH_NAME = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const query = searchQuery.trim().toLowerCase();
  const filteredRentals = rentals.filter((r) => {
    const item = getItem(r.itemId);
    const customer = getCustomer(r.customerId);
    const searchable = [
      r.id,
      r.status,
      r.startDate,
      r.endDate,
      item?.name,
      item?.designer,
      item?.category,
      customer?.name,
      customer?.email,
      customer?.phone,
      customer?.tier,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return !query || searchable.includes(query);
  });
  // Date range filter state — must be declared BEFORE monthsToRender useMemo
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);

  // Build the list of months to display.
  // When a date range filter is active, show ALL months from startDateFilter to endDateFilter.
  // Otherwise show only the current navigation month.
  const monthsToRender = useMemo(() => {
    if (!startDateFilter) {
      return [{ year: YEAR, month: MONTH }];
    }
    const [sy, sm] = startDateFilter.split("-").map(Number);
    const [ey, em] = (endDateFilter || startDateFilter).split("-").map(Number);
    const result: { year: number; month: number }[] = [];
    let cy = sy;
    let cm = sm - 1;
    const endYear = ey;
    const endMonth = em - 1;
    while (cy < endYear || (cy === endYear && cm <= endMonth)) {
      result.push({ year: cy, month: cm });
      cm++;
      if (cm > 11) { cm = 0; cy++; }
      if (result.length > 24) break; // safety cap: 2 years
    }
    return result.length > 0 ? result : [{ year: YEAR, month: MONTH }];
  }, [startDateFilter, endDateFilter, YEAR, MONTH]);

  // Build grid cells for a given month
  function buildCells(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Mon-start
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const cells: ({ day: number; date: string } | null)[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells.push(null);
      } else {
        const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        cells.push({ day: dayNum, date });
      }
    }
    return cells;
  }

  const isDateFilterActive = Boolean(startDateFilter || endDateFilter);

  const rangeEvents = useMemo(() => {
    if (!isDateFilterActive) return [];
    const fStart = startDateFilter || "1900-01-01";
    const fEnd = endDateFilter || startDateFilter || "2099-12-31";

    return filteredRentals.filter((r) => {
      const rStart = (r.startDate || r.deliveryDate || "").slice(0, 10);
      const rEnd = (r.endDate || r.startDate || r.deliveryDate || "").slice(0, 10);
      if (!rStart) return false;
      return rStart <= fEnd && rEnd >= fStart;
    });
  }, [filteredRentals, startDateFilter, endDateFilter, isDateFilterActive]);

  const isInSelectedRange = useMemo(() => {
    if (!startDateFilter) return () => false;
    const fStart = startDateFilter;
    const fEnd = endDateFilter || startDateFilter;
    return (dateStr: string) => Boolean(dateStr && dateStr >= fStart && dateStr <= fEnd);
  }, [startDateFilter, endDateFilter]);

  const handleClearDateFilter = () => {
    setStartDateFilter("");
    setEndDateFilter("");
    setIsRangeModalOpen(false);
  };

  const handleOpenRangeModal = () => {
    setSelectedDate(null);
    setIsRangeModalOpen(true);
  };

  useEffect(() => {
    if (startDateFilter) {
      const [y, m] = startDateFilter.split("-").map(Number);
      if (y && m && (y !== YEAR || m - 1 !== MONTH)) {
        setCurrentDate(new Date(y, m - 1, 1));
      }
    }
  }, [startDateFilter]);

  const eventsByDate: Record<string, typeof rentals> = {};
  filteredRentals.forEach((r) => {
    if (isDateFilterActive && !rangeEvents.some((re) => re.id === r.id)) {
      return;
    }
    const targetDateStr = (r.deliveryDate || r.startDate || "").slice(0, 10);
    if (!targetDateStr) return;

    const [y, m, d] = targetDateStr.split("-").map(Number);
    if (!y || !m || !d) return;

    // When range is active show events for ALL rendered months; otherwise only current month
    const isRendered = isDateFilterActive
      ? monthsToRender.some((mo) => mo.year === y && mo.month === m - 1)
      : (m - 1 === MONTH && y === YEAR);
    if (!isRendered) return;

    const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    eventsByDate[key] ??= [];
    eventsByDate[key].push(r);
  });

  const handlePrevMonth = () => setCurrentDate(new Date(YEAR, MONTH - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(YEAR, MONTH + 1, 1));
  const handleToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const upcoming = filteredRentals
    .filter((r) => r.status === "upcoming" || r.status === "active")
    .slice(0, 4);

  // For mobile list view: dates with events, sorted ascending
  const datesWithEvents = Object.entries(eventsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, evs]) => ({ date, events: evs }));

  const selectedEvents = isRangeModalOpen
    ? rangeEvents
    : (selectedDate ? (eventsByDate[selectedDate] || []) : []);

  useEffect(() => {
    const savedRole = localStorage.getItem("user_role")?.trim().toLowerCase();
    if (!savedRole) {
      navigate({ to: "/login" });
    }
    setRole(savedRole || "");
  }, []);

  useEffect(() => {
    console.info("[calendar] data loaded", {
      rentals: rentals.length,
      filteredRentals: filteredRentals.length,
      month: MONTH_NAME,
      searchQuery,
      readyRentals: rentals.filter((r) => (r as any).remarkCompleted).length,
    });
  }, [rentals, filteredRentals.length, MONTH_NAME, searchQuery]);

  useEffect(() => {
    if (!selectedDate && !isRangeModalOpen) return;
    console.info("[calendar] modal events", {
      selectedDate,
      isRangeModalOpen,
      events: selectedEvents.map((event) => ({
        id: event.id,
        billNo: event.billNo,
        itemId: event.itemId,
        customerId: event.customerId,
        status: event.status,
        remarkCompleted: (event as any).remarkCompleted,
        remarkConfirmedBy: (event as any).remarkConfirmedBy,
      })),
    });
  }, [selectedDate, isRangeModalOpen, rentals, selectedEvents]);

  const handleSelectDate = (date: string, eventsCount: number) => {
    console.info("[calendar] date selected", { date, eventsCount });
    setIsRangeModalOpen(false);
    setSelectedDate(date);
  };

  const handleMarkReady = (rentalId: string, currentName: string) => {
    console.info("[calendar] mark ready prompt opened", { rentalId, currentName });
    const name = window.prompt("Enter your name to confirm product is ready for delivery:", currentName);
    const trimmedName = name?.trim();

    if (!trimmedName) {
      console.info("[calendar] mark ready cancelled", { rentalId });
      return;
    }

    console.info("[calendar] mark ready request started", {
      rentalId,
      remarkConfirmedBy: trimmedName,
    });

    updateRental(rentalId, { remarkCompleted: true, remarkConfirmedBy: trimmedName } as any)
      .then((updatedRental) => {
        console.info("[calendar] mark ready request succeeded", {
          rentalId,
          updatedRental,
        });
        toast.success("Marked as ready!");
      })
      .catch((error) => {
        console.error("[calendar] mark ready request failed", {
          rentalId,
          error,
        });
        toast.error("Failed to update");
      });
  };

  const handleMarkFitting = (rentalId: string, currentName: string) => {
    console.info("[calendar] mark fitting prompt opened", { rentalId, currentName });
    const name = window.prompt("Enter your name to confirm fitting is complete:", currentName);
    const trimmedName = name?.trim();

    if (!trimmedName) {
      console.info("[calendar] mark fitting cancelled", { rentalId });
      return;
    }

    updateRental(rentalId, { fittingCompleted: true, fittingCompletedBy: trimmedName } as any)
      .then((updatedRental) => {
        console.info("[calendar] mark fitting request succeeded", { rentalId, updatedRental });
        toast.success("Marked fitting complete");
      })
      .catch((error) => {
        console.error("[calendar] mark fitting failed", { rentalId, error });
        toast.error("Failed to update");
      });
  };

  const handleMarkDryclean = (rentalId: string, currentName: string) => {
    console.info("[calendar] mark dryclean prompt opened", { rentalId, currentName });
    const name = window.prompt("Enter your name to confirm dryclean is complete:", currentName);
    const trimmedName = name?.trim();

    if (!trimmedName) {
      console.info("[calendar] mark dryclean cancelled", { rentalId });
      return;
    }

    console.info("[calendar] mark dryclean request started", {
      rentalId,
      drycleanCompletedBy: trimmedName,
    });

    updateRental(rentalId, { drycleanCompleted: true, drycleanCompletedBy: trimmedName } as any)
      .then((updatedRental) => {
        console.info("[calendar] mark dryclean request succeeded", { rentalId, updatedRental });
        toast.success("Marked dryclean complete");
      })
      .catch((error) => {
        console.error("[calendar] mark dryclean failed", { rentalId, error });
        toast.error("Failed to update");
      });
  };

  const handleAdminConfirmDryclean = (rentalId: string, currentName: string) => {
    console.info("[calendar] admin confirm dryclean prompt opened", { rentalId, currentName });
    const name = window.prompt("Enter your name to confirm dryclean and make item available:", currentName);
    const trimmedName = name?.trim();

    if (!trimmedName) {
      console.info("[calendar] admin confirm dryclean cancelled", { rentalId });
      return;
    }

    updateRental(rentalId, {
      drycleanAdminConfirmed: true,
      drycleanAdminConfirmedBy: trimmedName,
      drycleanAdminConfirmedAt: new Date().toISOString(),
    } as any)
      .then(async (updatedRental) => {
        console.info("[calendar] admin confirm dryclean succeeded", { rentalId, updatedRental });
        try {
          const itemObj = (updatedRental as any).item;
          const itemId = itemObj?.customId || itemObj?.id || (updatedRental as any).itemId;
          if (itemId) {
            await updateItem(itemId, { status: 'available' });
            toast.success('Dryclean confirmed and item marked ready for rent!');
          } else {
            toast.success('Dryclean confirmed!');
          }
        } catch (err) {
          console.error('[calendar] failed to mark item available after dryclean confirm', err);
          toast.success('Dryclean confirmed (failed to update item status)');
        }
      })
      .catch((error) => {
        console.error('[calendar] admin confirm dryclean failed', { rentalId, error });
        toast.error('Failed to confirm dryclean');
      });
  };

  const handleAdminReconfirm = (rentalId: string, currentName: string) => {
    console.info("[calendar] admin reconfirm prompt opened", { rentalId, currentName });
    const name = window.prompt("Enter your name to reconfirm this product is ready:", currentName);
    const trimmedName = name?.trim();

    if (!trimmedName) {
      console.info("[calendar] admin reconfirm cancelled", { rentalId });
      return;
    }

    updateRental(rentalId, {
      adminReconfirmed: true,
      adminReconfirmedBy: trimmedName,
      adminReconfirmedAt: new Date().toISOString(),
    } as any)
      .then(async (updatedRental) => {
        console.info("[calendar] admin reconfirm succeeded", {
          rentalId,
          updatedRental,
        });

        // After admin reconfirmation, mark the underlying item as available (ready for rent).
        try {
          const itemObj = (updatedRental as any).item;
          const itemId = itemObj?.customId || itemObj?.id || (updatedRental as any).itemId;
          if (itemId) {
            await updateItem(itemId, { status: 'available' });
            toast.success("Admin reconfirmed and item marked ready for rent!");
          } else {
            toast.success("Admin reconfirmed product is ready!");
          }
        } catch (err) {
          console.error('[calendar] failed to mark item available after admin reconfirm', err);
          toast.success("Admin reconfirmed product is ready! (failed to update item status)");
        }
      })
      .catch((error) => {
        console.error("[calendar] admin reconfirm failed", {
          rentalId,
          error,
        });
        toast.error("Failed to reconfirm");
      });
  };

  const handleExportExcel = () => {
    if (selectedEvents.length === 0) {
      console.info("[calendar] export skipped", {
        selectedDate,
        isRangeModalOpen,
        selectedEvents: selectedEvents.length,
      });
      return;
    }
    console.info("[calendar] export started", {
      selectedDate,
      isRangeModalOpen,
      selectedEvents: selectedEvents.length,
    });
    const exportData = selectedEvents.map((e) => {
      const item = getItem(e.itemId);
      const customer = getCustomer(e.customerId);
      return {
        "Bill No": e.billNo || e.id,
        "Customer": customer?.name || "Unknown",
        "Phone": customer?.phone || "-",
        "Item No": e.itemNo || e.itemId,
        "Piece / Item": item?.name || "Unknown",
        "Start Date": formatDate(e.startDate) || "-",
        "End Date": formatDate(e.endDate) || "-",
        "Delivery Date": formatDate(e.deliveryDate || e.startDate),
        Status: e.status,
        Remark: e.remark || "-",
        "Confirmed By": (e as any).remarkConfirmedBy || "-",
        "Admin Recheck": (e as any).adminReconfirmed ? "Recheck is done by admin" : "-",
        "Admin Recheck By": (e as any).adminReconfirmedBy || "-",
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 25 },
      { wch: 16 },
      { wch: 24 },
      { wch: 16 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");
    const filename = isRangeModalOpen
      ? `Bookings_${startDateFilter || "start"}_to_${endDateFilter || startDateFilter || "end"}.xlsx`
      : `Bookings_${selectedDate}.xlsx`;
    XLSX.writeFile(workbook, filename);
    console.info("[calendar] export completed", {
      filename,
      rows: exportData.length,
    });
  };

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4 sm:mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Diary</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">{MONTH_NAME}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Date Range Filter Toolbar */}
      <div className="mb-6 p-3.5 sm:p-4 rounded-xl glass-panel border border-border/80 bg-card/60 backdrop-blur-md shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <CalendarIcon className="w-4 h-4 text-gold" />
              <span>Filter Bookings by Date:</span>
            </div>

            {/* Start Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">Start:</span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="h-8 sm:h-9 px-2.5 text-xs rounded-md border border-input bg-background/90 text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 font-medium"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">End:</span>
              <input
                type="date"
                value={endDateFilter}
                min={startDateFilter || undefined}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="h-8 sm:h-9 px-2.5 text-xs rounded-md border border-input bg-background/90 text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 font-medium"
              />
            </div>

            {/* Clear Button */}
            {isDateFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearDateFilter}
                className="h-8 sm:h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                title="Clear date filter"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </Button>
            )}
          </div>

          {/* Results Badge & View Modal Button */}
          <div className="flex items-center gap-2">
            {isDateFilterActive && (
              <Badge variant="outline" className="bg-gold/15 text-gold border-gold/30 text-xs px-2.5 py-1">
                {rangeEvents.length} {rangeEvents.length === 1 ? "Booking" : "Bookings"}
              </Badge>
            )}
            {isDateFilterActive && rangeEvents.length > 0 && (
              <Button
                size="sm"
                onClick={handleOpenRangeModal}
                className="h-8 sm:h-9 bg-gold text-gold-foreground hover:bg-gold/90 text-xs gap-1.5 shadow-sm font-medium"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Bookings ({rangeEvents.length})</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 sm:gap-6">
        {/* Mobile: chronological day list */}
        <Card className="glass-panel p-0 overflow-hidden md:hidden">
          <div className="divide-y divide-border">
            {datesWithEvents.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                No calendar bookings match your search.
              </div>
            )}
            {datesWithEvents.map(({ date, events }) => {
              const [y, m, day] = date.split("-").map(Number);
              // Zeller-like: compute day-of-week without Date() to keep SSR + client identical
              const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
              const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              const dayName = DAY_NAMES[dow];
              const dayNum = day;
              return (
                <div 
                  key={date} 
                  className="flex gap-4 px-4 py-4 cursor-pointer hover:bg-secondary/20 transition-colors"
                  onClick={() => handleSelectDate(date, events.length)}
                >
                  <div className="text-center shrink-0 w-12">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-gold">
                      {dayName}
                    </div>
                    <div className="font-display text-2xl">{dayNum}</div>
                  </div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {events.map((e) => {
                      const item = getItem(e.itemId);
                      const colorClass =
                        e.status === "overdue"
                          ? "bg-destructive/15 text-destructive border-destructive/40"
                          : e.status === "active"
                            ? "bg-gold/15 text-gold border-gold/40"
                            : "bg-emerald/15 text-emerald border-emerald/40";
                      return (
                        <div
                          key={e.id}
                          className={`text-xs px-2 py-1 rounded-sm border truncate ${colorClass}`}
                        >
                          {item?.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Desktop/tablet: month grid — renders ALL months in range when filter active */}
        <div className="hidden md:flex flex-col gap-4">
          {monthsToRender.map(({ year, month }) => {
            const mCells = buildCells(year, month);
            const mName = new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });
            return (
              <Card key={`${year}-${month}`} className="glass-panel p-0 overflow-hidden">
                {/* Month heading — only shown when multi-month view is active */}
                {monthsToRender.length > 1 && (
                  <div className="px-4 py-3 border-b border-border bg-secondary/20">
                    <span className="text-sm font-semibold text-foreground tracking-wide">{mName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({Object.entries(eventsByDate).filter(([k]) => {
                        const [ky, km] = k.split("-").map(Number);
                        return ky === year && km - 1 === month;
                      }).reduce((acc, [, evs]) => acc + evs.length, 0)} bookings)
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-7 border-b border-border">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div
                      key={d}
                      className="px-3 py-2.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {mCells.map((cell, i) => {
                    const events = cell ? (eventsByDate[cell.date] ?? []) : [];
                    const isToday = cell?.date === todayStr;
                    const isCellInRange = cell?.date ? isInSelectedRange(cell.date) : false;
                    return (
                      <div
                        key={i}
                        className={`min-h-[6.5rem] p-2 relative ${
                          isToday ? "border-2 border-gold z-10 bg-gold/5" : "border-r border-b border-border"
                        } ${
                          isCellInRange ? "bg-gold/10 ring-1 ring-inset ring-gold/30" : ""
                        } ${
                          events.length > 0 ? "cursor-pointer hover:bg-secondary/20 transition-colors" : ""
                        }`}
                        onClick={() => {
                          if (events.length > 0 && cell) handleSelectDate(cell.date, events.length);
                        }}
                      >
                        {cell && (
                          <>
                            <div className={`text-xs mb-1.5 font-medium ${
                              isToday ? "text-gold" : isCellInRange ? "text-foreground" : "text-muted-foreground"
                            }`}>
                              {cell.day}
                            </div>
                            <div className="space-y-1">
                              {events.slice(0, 2).map((e) => {
                                const item = getItem(e.itemId);
                                const colorClass =
                                  e.status === "overdue"
                                    ? "bg-destructive/20 text-destructive border-destructive/40"
                                    : e.status === "active"
                                      ? "bg-gold/15 text-gold border-gold/40"
                                      : "bg-emerald/15 text-emerald border-emerald/40";
                                return (
                                  <div
                                    key={e.id}
                                    className={`text-[10px] truncate px-1.5 py-0.5 rounded-sm border ${colorClass}`}
                                    title={item?.name}
                                  >
                                    {item?.name}
                                  </div>
                                );
                              })}
                              {events.length > 2 && (
                                <div className="text-[10px] text-muted-foreground">
                                  +{events.length - 2} more
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="glass-panel h-fit">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4">
              Up Next
            </p>
            <div className="space-y-4">
              {upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No upcoming bookings match your search.
                </p>
              )}
              {upcoming.map((r) => {
                const item = getItem(r.itemId);
                const customer = getCustomer(r.customerId);
                if (!item || !customer) return null;
                const imgSrc = formatImageUrl(item.image);
                return (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 p-1.5 rounded-lg hover:bg-secondary/20 transition-colors cursor-pointer group"
                    onClick={() => setSelectedRental(r)}
                  >
                    <img
                      src={imgSrc}
                      alt={item.name}
                      width={48}
                      height={64}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
                      className="h-16 w-12 object-cover rounded-md border border-border shrink-0 shadow-xs bg-secondary/30 group-hover:shadow-md transition-shadow"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-semibold leading-tight text-foreground truncate group-hover:text-gold transition-colors">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {customer.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                        {formatDate(r.startDate)} to {formatDate(r.endDate)}
                      </p>
                      <div className="mt-1.5">
                        <StatusBadge status={r.status} kind="rental" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(selectedDate || isRangeModalOpen)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDate(null);
            setIsRangeModalOpen(false);
          }
        }}
      >
        <DialogContent className="w-[98vw] max-w-6xl xl:max-w-7xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pr-6">
            <div>
              <DialogTitle className="font-display text-2xl">
                {isRangeModalOpen
                  ? `Bookings: ${formatDate(startDateFilter)}${endDateFilter && endDateFilter !== startDateFilter ? ` to ${formatDate(endDateFilter)}` : ""}`
                  : `Bookings on ${selectedDate ? formatDate(selectedDate) : ""}`}
              </DialogTitle>
              <DialogDescription>
                {isRangeModalOpen
                  ? `Showing all ${selectedEvents.length} scheduled bookings active between selected dates.`
                  : "Detailed view of all scheduled bookings and remarks for this date."}
              </DialogDescription>
            </div>
            <Button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0"
            >
              <Download className="w-4 h-4" /> Export to Excel
            </Button>
          </DialogHeader>
          {/* Mobile Card List View (sm:hidden) */}
          <div className="divide-y divide-border sm:hidden mt-4 rounded-md border border-border bg-card">
            {selectedEvents.map((e) => {
              const item = getItem(e.itemId);
              const customer = getCustomer(e.customerId);
              return (
                <div key={e.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-gold bg-gold/10 px-2 py-0.5 rounded border border-gold/30">
                      Bill #{e.billNo || e.id}
                    </span>
                    <StatusBadge status={e.status} kind="rental" />
                  </div>
                  <div className="flex items-start gap-3">
                    <img
                      src={formatImageUrl(item?.image)}
                      alt={item?.name || "Item"}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
                      className="h-16 w-12 rounded-md object-cover border border-border shrink-0 bg-secondary/30 shadow-xs"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-bold text-foreground">{item?.name || "Unknown Piece"}</p>
                      <p className="text-xs text-muted-foreground">{customer?.name || "Unknown Client"} • {customer?.phone || ""}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">ID: {e.itemNo || e.itemId} • Size {item?.size || "-"} • Color {item?.color || "-"}</p>
                    </div>
                  </div>
                  <div className="bg-secondary/30 p-2.5 rounded-md space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Booking Dates:</span>
                      <span className="font-semibold text-foreground">{formatDate(e.startDate)} to {formatDate(e.endDate)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Delivery Date:</span>
                      <span className="font-semibold text-emerald-600">{formatDate(e.deliveryDate || e.startDate)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View - Designed to fit completely in one look without horizontal scrollbar */}
          <div className="hidden sm:block rounded-md border border-border mt-4 overflow-x-hidden">
            <Table className="text-xs w-full table-auto">
              <TableHeader className="bg-secondary/40">
                <TableRow className="border-b border-border">
                  <TableHead className="w-12 px-2.5 py-2 text-center whitespace-nowrap">Bill</TableHead>
                  <TableHead className="px-2.5 py-2 whitespace-nowrap">Client</TableHead>
                  <TableHead className="px-2.5 py-2 whitespace-nowrap">Piece / Item</TableHead>
                  <TableHead className="px-2.5 py-2 whitespace-nowrap">Size / Color</TableHead>
                  <TableHead className="px-2.5 py-2 whitespace-nowrap">Booking Dates</TableHead>
                  <TableHead className="px-2.5 py-2 whitespace-nowrap">Delivery</TableHead>
                  <TableHead className="px-2.5 py-2 text-center whitespace-nowrap">Status</TableHead>
                  <TableHead className="px-2.5 py-2 text-right whitespace-nowrap">Remark & Prep</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedEvents.map((e) => {
                  const item = getItem(e.itemId);
                  const customer = getCustomer(e.customerId);
                  const deliveryStr = (e.deliveryDate || e.startDate || "").slice(0, 10);
                  const daysToDelivery = Math.round((new Date(deliveryStr).getTime() - new Date(todayStr).getTime()) / 86400000);
                  const needsAttention = e.status !== "returned" && !!e.remark && !(e as any).remarkCompleted && daysToDelivery <= 5;
                  const isEmployeeReady = Boolean((e as any).remarkCompleted);
                  const isFittingDone = Boolean((e as any).fittingCompleted);
                  const isAdminReconfirmed = Boolean((e as any).adminReconfirmed);
                  const isDrycleanDone = Boolean((e as any).drycleanCompleted);
                  const isDrycleanAdminConfirmed = Boolean((e as any).drycleanAdminConfirmed);

                  return (
                    <TableRow key={e.id} className={needsAttention ? "bg-orange-500/5 hover:bg-orange-500/10" : "hover:bg-secondary/30"}>
                      <TableCell className="font-semibold text-center whitespace-nowrap px-2.5 py-2">{e.billNo || e.id}</TableCell>
                      <TableCell className="whitespace-nowrap px-2.5 py-2">
                        <div className="font-semibold text-xs text-foreground leading-tight">{customer?.name || "Unknown"}</div>
                        <div className="text-[11px] text-muted-foreground">{customer?.phone}</div>
                      </TableCell>
                      <TableCell className="px-2.5 py-2">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={formatImageUrl(item?.image)}
                            alt={item?.name || "Item"}
                            loading="lazy"
                            onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
                            className="h-11 w-9 rounded object-cover border border-border shrink-0 bg-secondary/30 shadow-2xs"
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-foreground truncate max-w-36" title={item?.name}>{item?.name || "Unknown Piece"}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{e.itemNo || e.itemId}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2.5 py-2">
                        <div className="text-xs font-medium text-foreground leading-tight">{item?.size ? `Size ${item.size}` : "-"}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-28">{item?.color || "-"}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2.5 py-2">
                        <div className="text-xs">
                          <span className="text-muted-foreground text-[10px]">Start: </span>
                          <span className="font-semibold text-foreground">{formatDate(e.startDate) || "-"}</span>
                        </div>
                        <div className="text-xs mt-0.5">
                          <span className="text-muted-foreground text-[10px]">End: </span>
                          <span className="font-semibold text-foreground">{formatDate(e.endDate) || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-2.5 py-2 font-medium text-emerald">
                        <div className="text-xs font-semibold leading-tight">{formatDate(e.deliveryDate || e.startDate)}</div>
                        {e.deliveryTimePeriod && (
                          <div className="text-[10px] text-muted-foreground font-normal">{e.deliveryTimePeriod}</div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center px-2.5 py-2">
                        <StatusBadge status={e.status} kind="rental" />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs px-2.5 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {e.remark && e.remark !== "-" && (
                            <div className="text-[11px] text-muted-foreground bg-secondary/50 border border-border/50 px-2 py-0.5 rounded max-w-32 truncate" title={e.remark}>
                              {e.remark}
                            </div>
                          )}
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {isDrycleanDone ? (
                              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 font-medium tracking-wide text-[9px] px-1.5 py-0.5 whitespace-nowrap">
                                Dryclean: {(e as any).drycleanCompletedBy}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5.5 px-2 text-[9px] uppercase tracking-wider text-indigo-700 border-indigo-500/40 hover:bg-indigo-500/10 whitespace-nowrap"
                                onClick={() => {
                                  const currentName = localStorage.getItem("user_name") || "";
                                  handleMarkDryclean(e.id, currentName);
                                }}
                              >
                                Mark Dryclean Done
                              </Button>
                            )}

                            {isFittingDone ? (
                              <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 font-medium tracking-wide text-[9px] px-1.5 py-0.5 whitespace-nowrap">
                                Fitting: {(e as any).fittingCompletedBy}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5.5 px-2 text-[9px] uppercase tracking-wider text-purple-700 border-purple-500/40 hover:bg-purple-500/10 whitespace-nowrap"
                                onClick={() => {
                                  const currentName = localStorage.getItem("user_name") || "";
                                  handleMarkFitting(e.id, currentName);
                                }}
                              >
                                Mark Fitting Done
                              </Button>
                            )}

                            {isDrycleanAdminConfirmed ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium tracking-wide text-[9px] px-1.5 py-0.5 whitespace-nowrap">
                                Dryclean Confirmed: {(e as any).drycleanAdminConfirmedBy}
                              </Badge>
                            ) : (
                              (role === "admin" || role === "reception") && isDrycleanDone && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-5.5 px-2 text-[9px] uppercase tracking-wider text-emerald-700 border-emerald-500/40 hover:bg-emerald-500/10 whitespace-nowrap"
                                  onClick={() => {
                                    const currentName = localStorage.getItem("user_name") || "";
                                    handleAdminConfirmDryclean(e.id, currentName);
                                  }}
                                >
                                  Confirm Dryclean
                                </Button>
                              )
                            )}

                            {isEmployeeReady ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium tracking-wide text-[9px] px-1.5 py-0.5 whitespace-nowrap">
                                Ready: {(e as any).remarkConfirmedBy}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5.5 px-2 text-[9px] uppercase tracking-wider text-orange-600 border-orange-500/40 hover:bg-orange-500/10 whitespace-nowrap"
                                onClick={() => {
                                  const currentName = localStorage.getItem("user_name") || "";
                                  handleMarkReady(e.id, currentName);
                                }}
                              >
                                Mark Ready
                              </Button>
                            )}
                            {isAdminReconfirmed ? (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-medium tracking-wide text-[9px] px-1.5 py-0.5 whitespace-nowrap">
                                Rechecked: {(e as any).adminReconfirmedBy}
                              </Badge>
                            ) : (
                              (role === "admin" || role === "reception") && isEmployeeReady && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-5.5 px-2 text-[9px] uppercase tracking-wider text-blue-600 border-blue-500/40 hover:bg-blue-500/10 whitespace-nowrap"
                                  onClick={() => {
                                    const currentName = localStorage.getItem("user_name") || "";
                                    handleAdminReconfirm(e.id, currentName);
                                  }}
                                >
                                  Admin Check
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rental Detail Popup (Up Next click) ── */}
      {selectedRental && (() => {
        const r = selectedRental;
        const item = getItem(r.itemId);
        const customer = getCustomer(r.customerId);
        const deliveryStr = (r.deliveryDate || r.startDate || "").slice(0, 10);
        const daysToDelivery = Math.round((new Date(deliveryStr).getTime() - new Date(todayStr).getTime()) / 86400000);
        const isEmployeeReady = Boolean((r as any).remarkCompleted);
        const isFittingDone = Boolean((r as any).fittingCompleted);
        const isDrycleanDone = Boolean((r as any).drycleanCompleted);
        const isDrycleanAdminConfirmed = Boolean((r as any).drycleanAdminConfirmed);
        const isAdminReconfirmed = Boolean((r as any).adminReconfirmed);
        const imgSrc = formatImageUrl(item?.image);

        return (
          <Dialog open onOpenChange={(open) => { if (!open) setSelectedRental(null); }}>
            <DialogContent className="w-[96vw] max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0">
              <DialogHeader className="sr-only">
                <DialogTitle>{item?.name || "Rental Detail"}</DialogTitle>
              </DialogHeader>

              {/* Top: image + name side by side */}
              <div className="flex items-stretch border-b border-border">
                <div className="shrink-0 w-28 h-36 bg-secondary/40 flex items-center justify-center overflow-hidden rounded-tl-xl">
                  <img
                    src={imgSrc}
                    alt={item?.name || "Item"}
                    onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <p className="font-display text-lg font-bold text-foreground leading-tight">{item?.name || "Unknown Piece"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item?.category || ""}{item?.designer ? ` · ${item.designer}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <span className="font-mono text-xs font-bold text-gold bg-gold/10 px-2.5 py-1 rounded border border-gold/30">
                      Bill #{r.billNo || r.id}
                    </span>
                    <StatusBadge status={r.status} kind="rental" />
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {item?.size && <span className="text-[10px] bg-secondary/60 px-2 py-0.5 rounded text-muted-foreground">Size {item.size}</span>}
                    {item?.color && <span className="text-[10px] bg-secondary/60 px-2 py-0.5 rounded text-muted-foreground">{item.color}</span>}
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Customer */}
                <div className="bg-secondary/30 rounded-lg px-3.5 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Customer</p>
                  <p className="font-semibold text-sm text-foreground">{customer?.name || "Unknown"}</p>
                  {customer?.phone && <p className="text-xs text-muted-foreground mt-0.5">{customer.phone}</p>}
                  {customer?.email && <p className="text-xs text-muted-foreground mt-0.5">{customer.email}</p>}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Start</p>
                    <p className="text-[11px] font-bold text-foreground">{formatDate(r.startDate) || "-"}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">End</p>
                    <p className="text-[11px] font-bold text-foreground">{formatDate(r.endDate) || "-"}</p>
                  </div>
                  <div className="bg-gold/10 border border-gold/30 rounded-lg p-2.5 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-gold mb-1">Delivery</p>
                    <p className="text-[11px] font-bold text-gold">{formatDate(r.deliveryDate || r.startDate) || "-"}</p>
                    {daysToDelivery >= 0 && r.status !== "returned" && (
                      <p className="text-[9px] text-gold/70 mt-0.5">{daysToDelivery === 0 ? "Today" : `in ${daysToDelivery}d`}</p>
                    )}
                  </div>
                </div>

                {/* Rent Amount */}
                {(r as any).rentAmount && (
                  <div className="flex items-center justify-between bg-secondary/30 rounded-lg px-3.5 py-2.5">
                    <span className="text-xs text-muted-foreground">Rent Amount</span>
                    <span className="font-bold text-sm text-foreground">{formatCurrencyINR((r as any).rentAmount)}</span>
                  </div>
                )}

                {/* Remark */}
                {r.remark && r.remark !== "-" && (
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg px-3.5 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-orange-500 mb-1">Remark</p>
                    <p className="text-xs text-foreground">{r.remark}</p>
                  </div>
                )}

                {/* Preparation actions */}
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Preparation Status</p>
                  <div className="flex flex-wrap gap-2">
                    {isDrycleanDone ? (
                      <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-xs">✓ Dryclean: {(r as any).drycleanCompletedBy}</Badge>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs text-indigo-700 border-indigo-500/40 hover:bg-indigo-500/10"
                        onClick={() => { const n = localStorage.getItem("user_name") || ""; handleMarkDryclean(r.id, n); }}>Mark Dryclean Done</Button>
                    )}
                    {isFittingDone ? (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-xs">✓ Fitting: {(r as any).fittingCompletedBy}</Badge>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs text-purple-700 border-purple-500/40 hover:bg-purple-500/10"
                        onClick={() => { const n = localStorage.getItem("user_name") || ""; handleMarkFitting(r.id, n); }}>Mark Fitting Done</Button>
                    )}
                    {isDrycleanAdminConfirmed ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">✓ Dryclean Confirmed: {(r as any).drycleanAdminConfirmedBy}</Badge>
                    ) : (
                      (role === "admin" || role === "reception") && isDrycleanDone && (
                        <Button size="sm" variant="outline" className="text-xs text-emerald-700 border-emerald-500/40 hover:bg-emerald-500/10"
                          onClick={() => { const n = localStorage.getItem("user_name") || ""; handleAdminConfirmDryclean(r.id, n); }}>Confirm Dryclean</Button>
                      )
                    )}
                    {isEmployeeReady ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">✓ Ready: {(r as any).remarkConfirmedBy}</Badge>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs text-orange-600 border-orange-500/40 hover:bg-orange-500/10"
                        onClick={() => { const n = localStorage.getItem("user_name") || ""; handleMarkReady(r.id, n); }}>Mark Ready</Button>
                    )}
                    {isAdminReconfirmed ? (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">✓ Rechecked: {(r as any).adminReconfirmedBy}</Badge>
                    ) : (
                      (role === "admin" || role === "reception") && isEmployeeReady && (
                        <Button size="sm" variant="outline" className="text-xs text-blue-600 border-blue-500/40 hover:bg-blue-500/10"
                          onClick={() => { const n = localStorage.getItem("user_name") || ""; handleAdminReconfirm(r.id, n); }}>Admin Check</Button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </AppShell>
  );
}
