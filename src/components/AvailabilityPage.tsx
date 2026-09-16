import { useMemo, useState } from "react";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { formatImageUrl, FALLBACK_IMG } from "@/lib/api";
import {
  CalendarDays,
  Search,
  Calendar,
  CheckCircle2,
  XCircle,
  Eye,
  Maximize2,
  ShoppingBag,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewRentalDialog } from "@/components/forms/NewRentalDialog";

const START_OF_DAY = "00:00";
const END_OF_DAY = "23:59";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatTime(value: string) {
  if (!value) return "";
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  return value.slice(0, 5);
}

function hasExplicitTime(value: string) {
  return value.includes("T") && formatTime(value) !== START_OF_DAY;
}

function formatDateTime(value: string) {
  if (!value) return "";
  if (!hasExplicitTime(value)) return formatDate(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function toLocalDateTime(date: string, time: string) {
  return new Date(`${date}T${time || START_OF_DAY}:00`);
}

function getRentalBoundary(value: string, boundary: "start" | "end") {
  if (!value) return new Date(NaN);

  const datePart = value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return date;

  if (hasExplicitTime(value)) return date;

  return boundary === "end"
    ? toLocalDateTime(datePart, END_OF_DAY)
    : toLocalDateTime(datePart, START_OF_DAY);
}

function ItemPreviewModal({ item, onClose }: { item: any; onClose: () => void }) {
  const [imgError, setImgError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const rawImages = item.images && item.images.length > 0 ? item.images : (item.image ? [item.image] : []);
  const firstImage = rawImages[0] || item.image;
  const imgSrc = imgError ? FALLBACK_IMG : (formatImageUrl(firstImage) || FALLBACK_IMG);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-0 border-gold/30 bg-background/95 backdrop-blur-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-border flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle className="font-display text-xl font-bold">
                {item.name}
              </DialogTitle>
              <Badge variant="outline" className="font-mono text-xs border-gold/40 text-gold bg-gold/10">
                {item.customId || item.id}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {item.designer || "Sajan Sagar Atelier"} • {item.category || "Couture"}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Main Popup Image Box */}
          <div
            onClick={() => setIsZoomed(!isZoomed)}
            className="relative bg-black/70 rounded-xl overflow-hidden border border-border flex items-center justify-center p-3 min-h-[260px] max-h-[450px] cursor-zoom-in group shadow-inner"
          >
            <img
              src={imgSrc}
              alt={item.name}
              onError={() => setImgError(true)}
              className={`w-auto max-w-full object-contain rounded-lg shadow-2xl transition-all duration-300 ${
                isZoomed ? "max-h-[70vh] scale-125" : "max-h-[380px] group-hover:scale-105"
              }`}
            />
            <div className="absolute top-3 right-3 bg-black/80 px-2.5 py-1 rounded-full text-[10px] text-gold font-semibold border border-gold/30 flex items-center gap-1 opacity-90 group-hover:opacity-100 shadow-md">
              <Maximize2 className="w-3 h-3" /> {isZoomed ? "Zoom Out" : "Click to Zoom HD"}
            </div>
          </div>

          {/* Item Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-secondary/30 rounded-lg border border-border">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-semibold">Category</span>
              <span className="font-bold text-foreground mt-0.5 block truncate">{item.category || "N/A"}</span>
              <span className="text-[11px] text-muted-foreground truncate block">{item.subcategory || "-"}</span>
            </div>

            <div className="p-3 bg-secondary/30 rounded-lg border border-border">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-semibold">Size & Color</span>
              <span className="font-bold text-foreground mt-0.5 block truncate">Size: {item.size || "N/A"}</span>
              <span className="text-[11px] text-muted-foreground truncate block">{item.color || "Standard"}</span>
            </div>

            <div className="p-3 bg-secondary/30 rounded-lg border border-border col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-semibold">Price / Security</span>
              <span className="font-bold text-gold text-sm mt-0.5 block">{formatCurrencyINR(item.rentalPrice || 0)}</span>
              <span className="text-[11px] text-muted-foreground block">Sec: {formatCurrencyINR(item.securityDeposit || 0)}</span>
            </div>
          </div>

          {item.notes && (
            <div className="p-3 bg-secondary/20 rounded-lg border border-border text-xs">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-semibold mb-1">Item Notes</span>
              <p className="text-muted-foreground leading-relaxed">{item.notes}</p>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
            <NewRentalDialog
              preselectedItem={item}
              trigger={
                <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90 font-bold text-xs gap-1.5 shadow-sm">
                  <ShoppingBag className="w-3.5 h-3.5" /> Book This Piece
                </Button>
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AvailabilityPage() {
  const { items, rentals, customers } = useStore();
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(START_OF_DAY);
  const [endTime, setEndTime] = useState(END_OF_DAY);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const availabilityData = useMemo(() => {
    const query = search.toLowerCase();
    const rawStart = toLocalDateTime(startDate, startTime);
    const rawEnd = toLocalDateTime(endDate, endTime);
    const targetStart = rawStart <= rawEnd ? rawStart : rawEnd;
    const targetEnd = rawStart <= rawEnd ? rawEnd : rawStart;
    
    return items
      .filter((item) => {
        const searchable = [item.name, item.id, item.customId, item.category, item.designer].join(" ").toLowerCase();
        return !query || searchable.includes(query);
      })
      .map((item) => {
        const itemRentals = rentals.filter((r) => r.itemId === item.id && (r.status === "active" || r.status === "upcoming" || r.status === "overdue"));
        
        itemRentals.sort((a, b) => getRentalBoundary(a.startDate || "", "start").getTime() - getRentalBoundary(b.startDate || "", "start").getTime());
        
        let currentRental = null;
        let nextAvailable = null;

        if (itemRentals.length > 0) {
          currentRental = itemRentals.find(r => {
            const rentalStart = getRentalBoundary(r.startDate || "", "start");
            const rentalEnd = getRentalBoundary(r.endDate || "", "end");
            
            if (r.status === "overdue") {
              return rentalStart <= targetEnd;
            }

            return rentalStart <= targetEnd && rentalEnd >= targetStart;
          });
          
          if (currentRental) {
             nextAvailable = getRentalBoundary(currentRental.endDate, "end");
             nextAvailable.setMinutes(nextAvailable.getMinutes() + 1);
          }
        }

        return {
          item,
          rentals: itemRentals,
          currentRental,
          nextAvailable
        };
      });
  }, [items, rentals, search, startDate, startTime, endDate, endTime]);

  const rawStart = toLocalDateTime(startDate, startTime);
  const rawEnd = toLocalDateTime(endDate, endTime);
  const targetStartDate = rawStart <= rawEnd ? startDate : endDate;
  const targetEndDate = rawStart <= rawEnd ? endDate : startDate;
  const targetStartTime = rawStart <= rawEnd ? startTime : endTime;
  const targetEndTime = rawStart <= rawEnd ? endTime : startTime;
  const isSingleDate = targetStartDate === targetEndDate;
  const displayDateRange = isSingleDate && targetStartTime === targetEndTime
    ? `${formatDate(targetStartDate)} ${targetStartTime}`
    : `${formatDate(targetStartDate)} ${targetStartTime} to ${formatDate(targetEndDate)} ${targetEndTime}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Modal Popup Image Preview */}
      {selectedItem && (
        <ItemPreviewModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Timeline</p>
          <h1 className="mt-2 text-3xl font-display font-bold flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-gold" />
            Availability
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Check product booking schedules and availability status. Click any item for popup details & HD image.
          </p>
        </div>

        {/* Mobile-Friendly Date & Time Filter Bar */}
        <div className="flex flex-col gap-3 w-full md:w-auto">
          {/* Mobile Filter Grid (sm:hidden) */}
          <div className="space-y-2 sm:hidden">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input value={formatDate(startDate)} readOnly className="pr-8 text-xs bg-card border-border" placeholder="Start Date" />
                <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={(e) => {
                    try { (e.target as HTMLInputElement).showPicker?.(); } catch (err) {}
                  }}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="text-xs bg-card border-border"
                aria-label="Start time"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input value={formatDate(endDate)} readOnly className="pr-8 text-xs bg-card border-border" placeholder="End Date" />
                <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e) => {
                    try { (e.target as HTMLInputElement).showPicker?.(); } catch (err) {}
                  }}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="text-xs bg-card border-border"
                aria-label="End time"
              />
            </div>

            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search products by name, ID, category..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs bg-card border-border"
              />
            </div>
          </div>

          {/* Desktop Filter Row (hidden sm:flex) */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="relative w-32">
                <Input value={formatDate(startDate)} readOnly className="pr-8 bg-card border-border text-xs" placeholder="Start" />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={(e) => {
                    try { (e.target as HTMLInputElement).showPicker?.(); } catch (err) {}
                  }}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-28 bg-card border-border text-xs"
                aria-label="Start time"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <div className="relative w-32">
                <Input value={formatDate(endDate)} readOnly className="pr-8 bg-card border-border text-xs" placeholder="End" />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e) => {
                    try { (e.target as HTMLInputElement).showPicker?.(); } catch (err) {}
                  }}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-28 bg-card border-border text-xs"
                aria-label="End time"
              />
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search products..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card border-border text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="grid gap-4">
        {availabilityData.length === 0 ? (
           <div className="p-8 text-center text-muted-foreground border border-border rounded-lg bg-card text-sm">
             No products found matching your search.
           </div>
        ) : (
          availabilityData.map(({ item, rentals: itemRentals, currentRental }) => {
            const isAvailable = !currentRental;
            const itemImgSrc = formatImageUrl(item.image) || FALLBACK_IMG;
            
            return (
              <Card key={item.id} className="overflow-hidden glass-panel p-0 gap-0 border-border/60 hover:border-gold/30 transition-all">
                <div className="flex flex-col md:flex-row">
                  {/* Left Column: Interactive Image Box */}
                  <div className="md:w-52 shrink-0 bg-secondary/20 border-b md:border-b-0 md:border-r border-border p-4 flex flex-col items-center justify-center text-center">
                    <div
                      onClick={() => setSelectedItem(item)}
                      className="relative cursor-pointer group mb-2.5 flex items-center justify-center rounded-lg overflow-hidden border border-border bg-black/20"
                    >
                      <img
                        src={itemImgSrc}
                        alt={item.name}
                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                        className="h-36 w-28 object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 p-1">
                        <Maximize2 className="w-5 h-5 text-gold" />
                        <span className="text-[10px] font-bold text-gold">Popup Preview</span>
                      </div>
                    </div>

                    <h3
                      onClick={() => setSelectedItem(item)}
                      className="font-semibold text-sm line-clamp-2 cursor-pointer hover:text-gold transition-colors"
                    >
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{item.customId || item.id}</p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={isAvailable ? "default" : "destructive"} className="text-xs px-2.5 py-0.5">
                        {isAvailable ? "Available" : "Busy"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedItem(item)}
                        className="h-7 text-xs px-2 text-gold hover:text-gold hover:bg-gold/10 gap-1 font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </Button>
                    </div>
                  </div>

                  {/* Right Column: Status & Booking Schedule */}
                  <div className="p-4 sm:p-5 flex-1">
                    <div className="mb-4">
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2.5 font-bold">
                        Status: {displayDateRange}
                      </h4>
                      <div className="flex items-center gap-3">
                        {isAvailable ? (
                          <>
                            <CheckCircle2 className="w-7 h-7 text-emerald-500 shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-emerald-600">Available {isSingleDate ? 'on' : 'from'} {displayDateRange}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {itemRentals.length > 0 ? "Has upcoming bookings on other dates." : "No upcoming bookings."}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-7 h-7 text-destructive shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-destructive">Busy {isSingleDate ? 'on' : 'during'} {displayDateRange}</p>
                              {currentRental && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Rented from {formatDateTime(currentRental.startDate)} to {formatDateTime(currentRental.endDate)}
                                </p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2 font-bold">
                        Booking Schedule
                      </h4>
                      {itemRentals.length === 0 ? (
                        <p className="text-xs text-muted-foreground bg-secondary/20 p-3 rounded-md border border-border">
                          No active or upcoming bookings for this item.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {itemRentals.map(rental => {
                             const customer = customers?.find(c => c.id === rental.customerId);
                             const rentalStart = getRentalBoundary(rental.startDate || "", "start");
                             const rentalEnd = getRentalBoundary(rental.endDate || "", "end");
                             const rangeStart = toLocalDateTime(targetStartDate, targetStartTime);
                             const rangeEnd = toLocalDateTime(targetEndDate, targetEndTime);
                             
                             const isCurrent = rentalStart <= rangeEnd && rentalEnd >= rangeStart;
                             const startPeriod = (rental as any).deliveryTimePeriod;
                             const endPeriod = (rental as any).endTimePeriod;
                             
                             return (
                               <div
                                 key={rental.id}
                                 className={`p-3 rounded-md border text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 ${
                                   isCurrent ? 'bg-gold/10 border-gold/40' : 'bg-secondary/20 border-border'
                                 }`}
                               >
                                 <div>
                                   <div className="font-medium text-foreground">
                                     {formatDateTime(rental.startDate)}{startPeriod ? ` (${startPeriod})` : ""}
                                     <span className="text-muted-foreground mx-1">to</span>
                                     {formatDateTime(rental.endDate)}{endPeriod ? ` (${endPeriod})` : ""}
                                   </div>
                                   <div className="text-xs text-muted-foreground mt-0.5">Bill No: {rental.billNo || rental.id}</div>
                                 </div>
                                 <div className="sm:text-right">
                                   <div className="font-medium text-foreground">{customer?.name || 'Unknown Client'}</div>
                                   <div className="text-xs text-muted-foreground mt-0.5">{customer?.phone || ''}</div>
                                 </div>
                                 <div className="shrink-0">
                                    <Badge variant="outline" className="capitalize text-xs">{rental.status}</Badge>
                                 </div>
                               </div>
                             );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
