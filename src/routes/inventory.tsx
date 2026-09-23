import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { formatImageUrl, FALLBACK_IMG } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Edit2, Plus, Trash2, Upload, X, ChevronLeft, ChevronRight, CalendarPlus, Maximize2, ZoomIn, ZoomOut, ExternalLink, SearchX } from "lucide-react";
import { AddPieceDialog } from "@/components/forms/AddPieceDialog";
import { EditPieceDialog } from "@/components/forms/EditPieceDialog";
import { NewRentalDialog } from "@/components/forms/NewRentalDialog";
import { matchesItemSearch } from "@/lib/searchUtils";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const DEFAULT_CATEGORIES = {
  MENS: "Mens",
  WOMENS: "Women's",
};

const DEFAULT_SUBCATEGORY_BY_CATEGORY = {
  "Mens": [
    "Suit",
    "Jodhpuri",
    "Sherwani",
    "Accessories",
  ],
  "Women's": [
    "Lehanga",
    "Sider jewellery",
    "Bridal jewellery",
    "Gown",
    "Rajputana Dress",
    "Accessories",
  ],
};


function FullScreenImageLightbox({
  images,
  initialIndex = 0,
  title,
  designer,
  onClose,
}: {
  images: string[];
  initialIndex?: number;
  title?: string;
  designer?: string;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState<1 | 1.5 | 2>(1);
  const [imgError, setImgError] = useState(false);

  const currentSrc = imgError || !images[currentIndex] ? FALLBACK_IMG : images[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && images.length > 1) {
        setZoomLevel(1);
        setImgError(false);
        setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      }
      if (e.key === "ArrowRight" && images.length > 1) {
        setZoomLevel(1);
        setImgError(false);
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose]);

  const toggleZoom = () => {
    setZoomLevel((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col justify-between text-white animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-white/10 bg-black/50 z-30">
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.35em] text-gold font-semibold font-mono">
            FULL PX VIEW
          </span>
          <span className="text-white/40">•</span>
          <h3 className="font-display text-lg sm:text-xl text-white font-medium truncate max-w-[200px] sm:max-w-md">
            {title || "Catalog Piece"}
          </h3>
          {designer && (
            <span className="text-xs text-gold/80 uppercase tracking-widest hidden md:inline">
              ({designer})
            </span>
          )}
          {images.length > 1 && (
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-gold/20 text-gold border border-gold/30">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleZoom}
            className="border-gold/50 bg-black/60 text-gold hover:bg-gold hover:text-black text-xs font-semibold gap-1.5 h-9 px-3"
          >
            {zoomLevel === 1 ? (
              <>
                <ZoomIn className="h-4 w-4" /> 100% (Fit)
              </>
            ) : zoomLevel === 1.5 ? (
              <>
                <ZoomIn className="h-4 w-4" /> 150% Zoom
              </>
            ) : (
              <>
                <ZoomOut className="h-4 w-4" /> 200% HD
              </>
            )}
          </Button>

          {currentSrc && currentSrc !== FALLBACK_IMG && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(currentSrc, "_blank")}
              className="border-white/20 bg-black/50 text-white hover:bg-white/20 text-xs gap-1.5 h-9 px-3 hidden sm:flex"
              title="Open Original Image File"
            >
              <ExternalLink className="h-4 w-4" /> Original File
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/30 text-white"
            aria-label="Close full view"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="relative flex-1 flex items-center justify-center overflow-auto p-4 sm:p-8 select-none">
        <div 
          className="relative max-h-full max-w-full flex items-center justify-center cursor-zoom-in transition-all duration-300"
          onClick={toggleZoom}
        >
          <img
            src={currentSrc}
            alt={title || "Full resolution view"}
            onError={() => setImgError(true)}
            style={{
              transform: `scale(${zoomLevel})`,
              transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            className="max-h-[82vh] max-w-[92vw] object-contain rounded-lg shadow-2xl border border-white/10"
          />
        </div>

        {/* Next / Previous arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/70 hover:bg-black border-gold/40 text-gold shadow-2xl z-30"
              onClick={(e) => {
                e.stopPropagation();
                setZoomLevel(1);
                setImgError(false);
                setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
              }}
            >
              <ChevronLeft className="h-7 w-7" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/70 hover:bg-black border-gold/40 text-gold shadow-2xl z-30"
              onClick={(e) => {
                e.stopPropagation();
                setZoomLevel(1);
                setImgError(false);
                setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
              }}
            >
              <ChevronRight className="h-7 w-7" />
            </Button>
          </>
        )}
      </div>

      {/* Bottom Thumbnail Bar */}
      {images.length > 1 && (
        <div className="flex justify-center gap-3 py-3 bg-black/70 border-t border-white/10 z-30 overflow-x-auto px-4">
          {images.map((img: string, idx: number) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setZoomLevel(1);
                setImgError(false);
                setCurrentIndex(idx);
              }}
              className={`h-14 w-12 rounded-md overflow-hidden border-2 transition-all shrink-0 ${
                idx === currentIndex ? "border-gold scale-110 shadow-lg" : "border-white/20 opacity-40 hover:opacity-100"
              }`}
            >
              <img src={img} alt={`Thumb ${idx + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCatalogModal({
  item,
  onClose,
  role,
  handleDelete,
  deletingId,
}: {
  item: any;
  onClose: () => void;
  role: string;
  handleDelete: (id: string, name: string) => void;
  deletingId: string | null;
}) {
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const rawImages = item.images && item.images.length > 0 ? item.images : (item.image ? [item.image] : []);
  const images = rawImages.map((img: string) => formatImageUrl(img)).filter(Boolean);
  const currentSrc = imgError ? FALLBACK_IMG : (images[activeImgIndex] || FALLBACK_IMG);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLightboxOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && images.length > 1) {
        setActiveImgIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      }
      if (e.key === "ArrowRight" && images.length > 1) {
        setActiveImgIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose, isLightboxOpen]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-300 overflow-y-auto lg:overflow-hidden">
      {/* Lightbox Full Page View */}
      {isLightboxOpen && (
        <FullScreenImageLightbox
          images={images.length > 0 ? images : [currentSrc]}
          initialIndex={activeImgIndex}
          title={item.name}
          designer={item.designer}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.35em] font-medium text-gold">The Vault Catalog</span>
          <span className="text-muted-foreground">•</span>
          <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/30 font-semibold">{item.customId || item.id}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-9 w-9 rounded-full hover:bg-secondary border border-border"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Catalog Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Left Column: Large Image Viewer */}
        <div className="lg:col-span-7 bg-black/40 relative flex flex-col justify-between p-4 sm:p-8 min-h-[380px] lg:min-h-0 border-r border-border/30">
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <StatusBadge status={item.status} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLightboxOpen(true)}
              className="bg-black/60 hover:bg-black border-gold/40 text-gold text-xs h-7 gap-1 px-2.5 shadow-lg"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Full Screen
            </Button>
          </div>

          <div
            onClick={() => setIsLightboxOpen(true)}
            className="relative flex-1 flex items-center justify-center overflow-hidden my-auto py-2 sm:py-4 cursor-pointer group/img"
          >
            <img
              src={currentSrc}
              alt={item.name}
              onError={() => setImgError(true)}
              className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-2xl transition-all duration-300 group-hover/img:scale-[1.02]"
            />

            {/* Hover overlay hint */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-lg z-10">
              <span className="px-4 py-2 rounded-full bg-black/90 text-gold text-xs font-semibold border border-gold/40 shadow-2xl flex items-center gap-2 transform translate-y-2 group-hover/img:translate-y-0 transition-transform">
                <Maximize2 className="w-4 h-4" /> Click to Open Full Page HD View
              </span>
            </div>

            {images.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background border-gold/30 shadow-lg z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImgIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                  }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background border-gold/30 shadow-lg z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImgIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                  }}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex justify-center gap-2.5 pt-3 overflow-x-auto z-20">
              {images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => {
                    setImgError(false);
                    setActiveImgIndex(idx);
                  }}
                  className={`h-16 w-12 rounded border-2 overflow-hidden transition-all shrink-0 ${
                    idx === activeImgIndex ? "border-gold scale-105 shadow-md" : "border-border/60 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Specification & Catalog Info */}
        <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between overflow-y-auto space-y-6 bg-background">
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold font-medium">{item.designer}</p>
              <h2 className="font-display text-3xl sm:text-4xl mt-1 leading-tight text-foreground">{item.name}</h2>
              <div className="flex items-baseline gap-3 mt-4">
                <span className="text-2xl sm:text-3xl font-display text-gold font-semibold">{formatCurrencyINR(item.pricePerDay)}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">/ day rental rate</span>
              </div>
            </div>

            <div className="hairline" />

            {/* Grid of specs */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="p-3.5 rounded-lg border border-border bg-secondary/20">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</p>
                <p className="text-sm font-medium mt-1">{item.category || "N/A"}</p>
              </div>
              <div className="p-3.5 rounded-lg border border-border bg-secondary/20">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Subcategory</p>
                <p className="text-sm font-medium mt-1">{item.subcategory || "N/A"}</p>
              </div>
              <div className="p-3.5 rounded-lg border border-border bg-secondary/20">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Size</p>
                <p className="text-sm font-medium mt-1">{item.size || "Standard"}</p>
              </div>
              <div className="p-3.5 rounded-lg border border-border bg-secondary/20">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Color</p>
                <p className="text-sm font-medium mt-1">{item.color || "N/A"}</p>
              </div>
              <div className="p-3.5 rounded-lg border border-border bg-secondary/20">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">In Stock Quantity</p>
                <p className="text-sm font-semibold text-foreground mt-1">{item.quantity ?? 1} pieces</p>
              </div>
              <div className="p-3.5 rounded-lg border border-border bg-secondary/20">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Times Rented</p>
                <p className="text-sm font-medium mt-1">{item.timesRented ?? 0} rentals</p>
              </div>
            </div>

            {item.retailValue > 0 && (
              <div className="p-4 rounded-lg border border-gold/30 bg-gold/5 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Estimated Retail MRP</span>
                <span className="font-display text-lg text-gold font-semibold">{formatCurrencyINR(item.retailValue)}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-6 border-t border-border space-y-3">
            <NewRentalDialog
              preselectedItem={item}
              trigger={
                <Button className="w-full bg-gold text-gold-foreground hover:bg-gold/90 h-12 text-sm uppercase tracking-wider font-semibold shadow-lg">
                  <CalendarPlus className="h-4 w-4 mr-2" /> Book Piece / New Rental
                </Button>
              }
            />

            {(role === "admin" || role === "reception") && (
              <div className="flex gap-3">
                <EditPieceDialog
                  item={item}
                  trigger={
                    <Button variant="outline" className="flex-1 border-gold/40 hover:bg-gold/10 h-10 text-xs uppercase tracking-wider">
                      <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit Piece
                    </Button>
                  }
                  onUpdated={() => toast.success(`Updated ${item.name}`)}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="h-10 text-xs uppercase tracking-wider">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display text-2xl">Delete {item.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the piece from inventory catalog.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deletingId === item.id}
                        onClick={() => {
                          handleDelete(item.id, item.name);
                          onClose();
                        }}
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryItemCard({ item, role, deletingId, handleDelete, onSelect }: { item: any; role: string; deletingId: string | null; handleDelete: (id: string, name: string) => void; onSelect: (item: any) => void; }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const rawImages = item.images && item.images.length > 0 ? item.images : (item.image ? [item.image] : []);
  const images = rawImages.map((img: string) => formatImageUrl(img)).filter(Boolean);
  const currentSrc = imgError ? FALLBACK_IMG : (images[imgIndex] || FALLBACK_IMG);

  return (
    <Card
      onClick={() => onSelect(item)}
      className="glass-card hover-lift overflow-hidden group rounded-2xl cursor-pointer p-0 gap-0 border border-gold/20 hover:border-gold/50"
    >
      <div className="relative aspect-3/4 overflow-hidden bg-secondary/40">
        <img
          src={currentSrc}
          alt={item.name}
          width={640}
          height={800}
          loading="lazy"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
        />
        
        {/* Fullscreen Overlay Hint on Hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none z-10">
          <span className="px-4 py-2 rounded-full bg-black/80 text-gold text-xs font-medium border border-gold/40 shadow-xl flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <Maximize2 className="w-3.5 h-3.5" /> Quick View
          </span>
        </div>

        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {images.map((_: any, i: number) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setImgIndex(i);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all shadow-sm ${i === imgIndex ? "bg-gold scale-125" : "bg-white/60 hover:bg-white"}`}
                aria-label={`View image ${i + 1}`}
              />
            ))}
          </div>
        )}

        <div className="absolute top-3 left-3 z-10">
          <StatusBadge status={item.status} />
        </div>
        {(role === "admin" || role === "reception") && (
          <div className="absolute top-3 right-3 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 z-20" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <EditPieceDialog
                item={item}
                trigger={
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8 border-gold/40 bg-black/60 text-gold hover:bg-gold hover:text-black transition-colors" aria-label={`Edit ${item.name}`}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                }
                onUpdated={() => toast.success(`Updated ${item.name}`)}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="icon" variant="destructive" className="h-8 w-8 bg-destructive/90 text-destructive-foreground hover:bg-destructive" aria-label={`Delete ${item.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display text-2xl">Delete {item.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the piece from inventory. Any rentals linked to this item will also disappear from this screen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deletingId === item.id} onClick={() => handleDelete(item.id, item.name)}>
                      {deletingId === item.id ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/80 to-transparent pointer-events-none" />
      </div>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold font-semibold truncate">{item.designer}</p>
        <h3 className="font-display text-lg mt-1 font-semibold leading-tight text-foreground truncate">{item.name}</h3>
        <div className="flex items-baseline justify-between mt-3 gap-2">
          <span className="text-gold font-display text-xl font-bold">{formatCurrencyINR(item.pricePerDay)}</span>
          <span className="text-xs text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded shrink-0">Size {item.size}</span>
        </div>
        <div className="hairline mt-3" />
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span className="font-mono text-[11px] text-gold/80">{item.customId || item.id}</span>
          <span>{item.timesRented} rentals</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

export default function InventoryPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (!role) {
      navigate({ to: "/login" });
    }
  }, []);

  const { items, loading, deleteItem, searchQuery, setSearchQuery, addItem } = useStore();
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSubcategory, setActiveSubcategory] = useState("All");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const query = searchQuery.trim().toLowerCase();
  const compactQuery = query.replace(/[\s-_]/g, "");

  const role = typeof window !== "undefined"
    ? localStorage.getItem("user_role") || "employee"
    : "employee";

  const itemCategories = Array.from(
    new Set([
      ...Object.values(DEFAULT_CATEGORIES),
      ...items.map((i: any) => i.category).filter(Boolean),
    ]),
  );

  const dynamicSubcategoryByCategory = items.reduce(
    (acc: Record<string, string[]>, item: any) => {
      if (!item.category || !item.subcategory) return acc;
      const current = acc[item.category] || [
        ...(DEFAULT_SUBCATEGORY_BY_CATEGORY[item.category as keyof typeof DEFAULT_SUBCATEGORY_BY_CATEGORY] || []),
      ];
      if (!current.includes(item.subcategory)) {
        current.push(item.subcategory);
      }
      acc[item.category] = current;
      return acc;
    },
    {
      ...DEFAULT_SUBCATEGORY_BY_CATEGORY,
    } as Record<string, string[]>,
  );

  const categoryOptions = itemCategories;

  const itemMatchesSearch = (i: any) => {
    return matchesItemSearch(i, searchQuery);
  };

  const filteredItems = items.filter((i) => {
    const matchesCategory = activeCategory === "All" || i.category === activeCategory;
    const matchesSubcategory = activeSubcategory === "All" || i.subcategory === activeSubcategory;
    return matchesCategory && matchesSubcategory && itemMatchesSearch(i);
  });

  const subcategories =
    activeCategory !== "All"
      ? dynamicSubcategoryByCategory[activeCategory] || []
      : [];

  // Counts for UI chips (respects current search query)
  const availableItems = items.filter(itemMatchesSearch);

  const categoryCounts: Record<string, number> = availableItems.reduce(
    (acc: Record<string, number>, i: any) => {
      if (!i.category) return acc;
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    },
    {},
  );

  const typeCounts: Record<string, number> = availableItems.reduce(
    (acc: Record<string, number>, i: any) => {
      acc[i.subcategory] = (acc[i.subcategory] || 0) + 1;
      return acc;
    },
    {}
  );


  async function handleDelete(id: string, name: string) {
    console.info("[InventoryPage] delete requested", { id, name });
    setDeletingId(id);
    try {
      await deleteItem(id);
      toast.success(`${name} deleted`);
      console.info("[InventoryPage] delete success", { id, name });
    } catch (error) {
      console.error("[InventoryPage] delete failed", { id, name, error });
      toast.error(`Failed to delete ${name}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['.xlsx', '.xls', '.csv'];
    const isValidType = validTypes.some(type => file.name.toLowerCase().endsWith(type));
    if (!isValidType) {
      toast.error('Please select a valid Excel (.xlsx, .xls) or CSV file');
      return;
    }

    setUploading(true);
    try {
      // Read file on frontend to bypass strict backend validation
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rows.length === 0) {
        toast.error("The uploaded file appears to be empty.");
        return;
      }

      toast.info(`Found ${rows.length} rows. Importing...`);
      let successCount = 0;

      for (const rawRow of rows) {
        try {
          // Normalize row keys to lowercase and trim spaces
          const row: Record<string, any> = {};
          for (const key in rawRow) {
            row[key.toLowerCase().trim()] = rawRow[key];
          }

          // Forgiving mapping with smart defaults so data is accepted easily
          await addItem({
            name: String(row.name || row.item || row.title || row.piece || "Unnamed Piece"),
            designer: String(row.designer || row.brand || row.maker || "Unknown"),
            category: String(row.category || row.department || "Women's"),
            subcategory: String(row.subcategory || row.type || row.style || "Lehanga"),
            size: String(row.size || row.fit || "M"),
            color: String(row.color || row.shade || row.hue || "Unknown"),
            pricePerDay: (() => {
              const raw = row.price ?? row.rent ?? row.rate ?? row.cost ?? row["price/day"] ?? row["price per day"] ?? row["rent/day"] ?? row["price / day (inr)"] ?? row["price/day (inr)"] ?? 0;
              const cleaned = String(raw).replace(/[^0-9.-]/g, "").trim();
              const n = Number(cleaned);
              return Number.isNaN(n) ? 0 : n;
            })(),
            retailValue: (() => {
              const raw = row.retail ?? row.value ?? row.mrp ?? row["retail value"] ?? row["retail value (inr)"] ?? row.original ?? 0;
              const cleaned = String(raw).replace(/[^0-9.-]/g, "").trim();
              const n = Number(cleaned);
              return Number.isNaN(n) ? 0 : n;
            })(),
            quantity: (() => {
              const raw = row.quantity ?? row.qty ?? row.stock ?? row["stock quantity"] ?? 1;
              const n = Number(String(raw).replace(/[^0-9.-]/g, "").trim());
              return Number.isNaN(n) ? 1 : Math.max(0, Math.floor(n));
            })(),
            status: "available",
            image: String(row.image || row.photo || row.picture || row.img || "")
          });
          successCount++;
        } catch (err) {
          console.error("Skipped a row due to error:", err);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} pieces!`);
      } else {
        toast.error("Could not import any items. Check file format.");
      }
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading inventory...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">
            The Vault
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Inventory</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {items.length} pieces curated - {items.filter((i) => i.status === "available").length} available
          </p>
        </div>
      {["admin", "employee", "reception"].includes(role) && (
        <div className="flex gap-2">
          {['admin', 'employee', 'reception'].includes(role) && (
            <Button
              variant="outline"
              className="border-gold text-gold hover:bg-gold hover:text-gold-foreground"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              {uploading ? "Uploading..." : "Upload Excel"}
            </Button>
          )}
          <AddPieceDialog
            categories={categoryOptions}
            subcategoryByCategory={dynamicSubcategoryByCategory}
            trigger={
              <Button className="bg-gold text-gold-foreground hover:bg-gold/90 self-start sm:self-auto">
                <Plus className="h-4 w-4 mr-1.5" /> Add Piece
              </Button>
            }
          />
        </div>
      )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      <div className="mb-6 sm:mb-8">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Category</h3>
        <div className="flex flex-wrap gap-2 -mx-1 px-1 overflow-x-auto sm:overflow-visible">
          {['All', ...categoryOptions].map((c) => {
            const count = c === "All" ? availableItems.length : categoryCounts[c] ?? 0;
            return (
              <button
                key={c}
                onClick={() => {
                  setActiveCategory(c);
                  setActiveSubcategory("All");
                }}
                className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] border transition-colors ${
                  activeCategory === c
                    ? "bg-gold text-gold-foreground border-gold"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-gold/40"
                }`}
              >
                <span className="mr-1">{c}</span>
                <span className={`text-[10px] ${
                  activeCategory === c ? "text-gold-foreground/90" : "text-muted-foreground"
                }`}>({count})</span>
              </button>
            );
          })}

        </div>
      </div>

      {activeCategory !== "All" && subcategories.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Type</h3>
          <div className="flex flex-wrap gap-2 -mx-1 px-1 overflow-x-auto sm:overflow-visible">
            {["All", ...subcategories].map((s) => (
              <button
                key={s}
                onClick={() => setActiveSubcategory(s)}
                className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] border transition-colors ${
                  activeSubcategory === s
                    ? "bg-accent text-accent-foreground border-accent"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-accent/40"
                }`}
              >
                <span className="mr-1">{s}</span>
                <span className={`text-[10px] ${
                  activeSubcategory === s ? "text-accent-foreground/90" : "text-muted-foreground"
                }`}>({s === "All" ? availableItems.filter((i:any)=> i.category === activeCategory).length : typeCounts[s] ?? 0})</span>
              </button>
            ))}

          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {filteredItems.length === 0 && (
          <Card className="glass-panel col-span-full py-12 px-6 text-center text-muted-foreground flex flex-col items-center justify-center gap-3 border border-gold/20">
            <div className="h-14 w-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold mb-1">
              <SearchX className="h-7 w-7" />
            </div>
            <p className="font-display text-2xl text-foreground font-semibold">
              {query ? "No item found" : "No items available"}
            </p>
            <p className="text-sm text-muted-foreground max-w-md">
              {query
                ? `No item found matching "${searchQuery}". Please verify the item number or search term.`
                : "No inventory pieces match the selected category or filters."}
            </p>
            {query && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs border-gold/40 text-gold hover:bg-gold/10"
              >
                Clear Search
              </Button>
            )}
          </Card>
        )}
        {filteredItems.map((item) => (
          <InventoryItemCard key={item.id} item={item} role={role} deletingId={deletingId} handleDelete={handleDelete} onSelect={setSelectedCatalogItem} />
        ))}
      </div>

      {selectedCatalogItem && (
        <ItemCatalogModal
          item={selectedCatalogItem}
          onClose={() => setSelectedCatalogItem(null)}
          role={role}
          handleDelete={handleDelete}
          deletingId={deletingId}
        />
      )}
    </AppShell>
  );
}
