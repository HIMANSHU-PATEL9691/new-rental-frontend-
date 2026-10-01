import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import {
  itemsApi,
  customersApi,
  rentalsApi,
  formatImageUrl,
  FALLBACK_IMG,
  type Item,
  type Customer,
  type Rental,
} from "@/lib/api";

interface StoreState {
  items: Item[];
  customers: Customer[];
  rentals: Rental[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  addItem: (item: Omit<Item, "_id" | "id" | "customId" | "timesRented" | "createdAt" | "updatedAt">) => Promise<Item>;
  uploadExcel: (file: File) => Promise<{ message: string; items: { id: string; name: string }[]; errors?: string[] }>;
  deleteItem: (id: string) => Promise<void>;
  addCustomer: (
    customer: Omit<Customer, "_id" | "id" | "customId" | "totalSpent" | "rentals" | "joined" | "createdAt" | "updatedAt">,
  ) => Promise<Customer>;
  addRental: (rental: Omit<Rental, "_id" | "id" | "customId" | "createdAt" | "updatedAt">) => Promise<Rental>;
  deleteCustomer: (id: string) => Promise<void>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<Customer>;
  deleteRental: (id: string) => Promise<void>;
  updateRental: (id: string, data: Partial<Rental>) => Promise<Rental>;
  updateItem: (id: string, data: Partial<Item>) => Promise<Item>;
  getItem: (id: string) => Item | undefined;
  getCustomer: (id: string) => Customer | undefined;
  refreshData: (branchOverride?: string) => Promise<void>;
}


const StoreContext = createContext<StoreState | null>(null);

// Transform backend data to match frontend interface
function transformItem(item: any): Item {
  const rawImages = Array.isArray(item.images) && item.images.length > 0
    ? item.images
    : (item.image ? [item.image] : []);
  
  const formattedImages = rawImages.map((img: string) => formatImageUrl(img)).filter(Boolean);
  const singleImage = formatImageUrl(item.image);

  return {
    ...item,
    id: item.customId,
    image: singleImage,
    images: formattedImages.length > 0 ? formattedImages : [singleImage],
    quantity: Number(item.quantity) || 1,
  };
}

function transformCustomer(customer: any): Customer {
  return {
    ...customer,
    id: customer.customId,
  };
}

function formatDateTime(value: string | Date | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function transformRental(rental: any): Rental {
  const itemId =
    rental.itemId ||
    rental.item?.customId ||
    (typeof rental.item === "string" ? rental.item : "");
  const customerId =
    rental.customerId ||
    rental.customer?.customId ||
    (typeof rental.customer === "string" ? rental.customer : "");

  return {
    ...rental,
    id: rental.customId,
    itemId,
    customerId,
    itemNo: rental.itemNo || rental.item?.customId || itemId || "",
    rate: Number(rental.rate) || Number(rental.total) + Number(rental.discount || 0) || 0,
    quantity: Number(rental.quantity) || 1,
    lostQuantity: Number(rental.lostQuantity) || 0,
    deliveryDate: rental.deliveryDate ? formatDateTime(rental.deliveryDate) : "",
    deliveryTime: rental.deliveryTime || "",
    deliveryTimePeriod: rental.deliveryTimePeriod || "",
    startDate: formatDateTime(rental.startDate || rental.deliveryDate),
    endDate: formatDateTime(rental.endDate),
    endTime: rental.endTime || "",
    endTimePeriod: rental.endTimePeriod || "",
    billMakingDate: rental.billMakingDate ? formatDateTime(rental.billMakingDate) : "",
  };
}

import { idbGet, idbSet } from "@/lib/idb";

function getInitialCache<T>(key: string, fallback: T): T {
  if (typeof window === "undefined" || !window.sessionStorage) return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setCache<T>(key: string, data: T) {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>(() => getInitialCache("cozy_items", []));
  const [customers, setCustomers] = useState<Customer[]>(() => getInitialCache("cozy_customers", []));
  const [rentals, setRentals] = useState<Rental[]>(() => getInitialCache("cozy_rentals", []));
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const isFetchingRef = useRef(false);

  // Instant hydration from IndexedDB on startup
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cachedItems, cachedCustomers, cachedRentals] = await Promise.all([
          idbGet<Item[]>("cozy_items"),
          idbGet<Customer[]>("cozy_customers"),
          idbGet<Rental[]>("cozy_rentals"),
        ]);
        if (active) {
          if (cachedItems && cachedItems.length > 0) setItems(cachedItems);
          if (cachedCustomers && cachedCustomers.length > 0) setCustomers(cachedCustomers);
          if (cachedRentals && cachedRentals.length > 0) setRentals(cachedRentals);
          if (cachedItems && cachedItems.length > 0) setLoading(false);
        }
      } catch (err) {
        console.warn("[store] IDB read error", err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const [selectedBranch, setSelectedBranchState] = useState<string>(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const role = (window.localStorage.getItem("user_role") || "").trim().toLowerCase();
      const userBranch = window.localStorage.getItem("user_branch");
      const stored = window.localStorage.getItem("selected_branch");
      if (role && role !== "admin") {
        const effective = userBranch || stored || "Shop 1";
        if (userBranch !== effective) window.localStorage.setItem("user_branch", effective);
        if (stored !== effective) window.localStorage.setItem("selected_branch", effective);
        return effective;
      }
      return stored || userBranch || "Shop 1";
    }
    return "Shop 1";
  });

  const setSelectedBranch = (branch: string) => {
    if (typeof window !== "undefined" && window.localStorage) {
      const role = (window.localStorage.getItem("user_role") || "").trim().toLowerCase();
      const userBranch = window.localStorage.getItem("user_branch");
      const effectiveBranch = (role && role !== "admin") ? (userBranch || branch || "Shop 1") : branch;
      window.localStorage.setItem("selected_branch", effectiveBranch);
      if (role && role !== "admin") {
        window.localStorage.setItem("user_branch", effectiveBranch);
      }
      setSelectedBranchState(effectiveBranch);
      return;
    }
    setSelectedBranchState(branch);
  };

  const getEffectiveBranch = useCallback(() => {
    return selectedBranch || "Shop 1";
  }, [selectedBranch]);

  const refreshData = useCallback(async (branchOverride?: string) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const role = typeof window !== "undefined" && window.localStorage ? (window.localStorage.getItem("user_role") || "").trim().toLowerCase() : "";
    const userBranch = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem("user_branch") : null;
    const effectiveBranch = (role && role !== "admin" && userBranch) ? userBranch : (branchOverride !== undefined ? branchOverride : selectedBranch);

    console.info("[store] refreshData started for branch:", effectiveBranch);
    try {
      console.info("[store] fetching items, customers, and rentals");
      const [itemsData, customersData, rentalsData] = await Promise.all([
        itemsApi.getAll(effectiveBranch),
        customersApi.getAll(effectiveBranch),
        rentalsApi.getAll(effectiveBranch),
      ]);
      const itemsList = Array.isArray(itemsData)
        ? itemsData
        : (itemsData && typeof itemsData === "object" && Array.isArray((itemsData as any).items)
          ? (itemsData as any).items
          : (itemsData && typeof itemsData === "object" && Array.isArray((itemsData as any).data)
            ? (itemsData as any).data
            : []));
      const customersList = Array.isArray(customersData)
        ? customersData
        : (customersData && typeof customersData === "object" && Array.isArray((customersData as any).customers)
          ? (customersData as any).customers
          : (customersData && typeof customersData === "object" && Array.isArray((customersData as any).data)
            ? (customersData as any).data
            : []));
      const rentalsList = Array.isArray(rentalsData)
        ? rentalsData
        : (rentalsData && typeof rentalsData === "object" && Array.isArray((rentalsData as any).rentals)
          ? (rentalsData as any).rentals
          : (rentalsData && typeof rentalsData === "object" && Array.isArray((rentalsData as any).data)
            ? (rentalsData as any).data
            : []));

      console.info("[store] fetch complete", {
        items: itemsList.length,
        customers: customersList.length,
        rentals: rentalsList.length,
      });
      const mappedItems = itemsList.map(transformItem);
      const mappedCustomers = customersList.map(transformCustomer);
      const mappedRentals = rentalsList.map(transformRental);

      setItems(mappedItems);
      setCustomers(mappedCustomers);
      setRentals(mappedRentals);

      setCache("cozy_customers", mappedCustomers);
      setCache("cozy_rentals", mappedRentals);
      idbSet("cozy_items", mappedItems);
      idbSet("cozy_customers", mappedCustomers);
      idbSet("cozy_rentals", mappedRentals);
      console.info("[store] state updated from backend data");
    } catch (error) {
      console.error('[store] Failed to fetch data:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      console.info("[store] loading=false");
    }
  }, [selectedBranch]);

  useEffect(() => {
    console.info("[store] Initial data load");
    refreshData(selectedBranch);
  }, [selectedBranch, refreshData]);

  useEffect(() => {
    const syncBranchFromStorage = () => {
      if (typeof window !== "undefined" && window.localStorage) {
        const role = (window.localStorage.getItem("user_role") || "").trim().toLowerCase();
        const userBranch = window.localStorage.getItem("user_branch");
        const stored = window.localStorage.getItem("selected_branch");
        const effective = (role && role !== "admin") ? (userBranch || stored || "Shop 1") : (stored || "Shop 1");
        if (effective !== selectedBranch) {
          console.info("[store] Syncing selectedBranch from storage:", effective);
          setSelectedBranchState(effective);
        }
      }
    };

    window.addEventListener("popstate", syncBranchFromStorage);
    window.addEventListener("storage", syncBranchFromStorage);
    syncBranchFromStorage();

    return () => {
      window.removeEventListener("popstate", syncBranchFromStorage);
      window.removeEventListener("storage", syncBranchFromStorage);
    };
  }, [selectedBranch]);

  const itemMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const item of items) {
      if (item.id) map.set(item.id, item);
      if (item.customId) map.set(item.customId, item);
      if ((item as any)._id) map.set(String((item as any)._id), item);
      if (item.barcode) map.set(item.barcode, item);
    }
    return map;
  }, [items]);

  const customerMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of customers) {
      if (c.id) map.set(c.id, c);
      if (c.customId) map.set(c.customId, c);
      if ((c as any)._id) map.set(String((c as any)._id), c);
      if (c.phone) map.set(c.phone, c);
    }
    return map;
  }, [customers]);

  const value = useMemo<StoreState>(
    () => ({
      items,
      customers,
      rentals,
      loading,
      searchQuery,
      setSearchQuery: (query) => {
        console.info("[store] searchQuery updated", { query });
        setSearchQuery(query);
      },
      selectedBranch,
      setSelectedBranch,
      addItem: async (data) => {
        console.info("[store] addItem started", {
          name: data.name,
          category: data.category,
          hasImage: Boolean(data.image),
          imageLength: data.image?.length ?? 0,
        });
        const branchToUse = data.branch || getEffectiveBranch();
        const newItem = await itemsApi.create({ ...data, branch: branchToUse });
        console.info("[store] addItem backend response", newItem);
        const transformed = transformItem(newItem);
        setItems((prev) => {
          const next = [transformed, ...prev.filter((i) => i.id !== transformed.id && i.customId !== transformed.id)];
          idbSet("cozy_items", next);
          return next;
        });
        console.info("[store] addItem state updated", transformed);
        return transformed;
      },
      uploadExcel: async (file) => {
        console.info("[store] uploadExcel started", { fileName: file.name, fileSize: file.size, branch: selectedBranch });
        const result = await itemsApi.uploadExcel(file, selectedBranch);
        console.info("[store] uploadExcel backend response", result);
        await refreshData(selectedBranch);
        console.info("[store] uploadExcel data refreshed");
        return result;
      },
      deleteItem: async (id) => {
        console.info("[store] deleteItem started", { id });
        await itemsApi.delete(id);
        console.info("[store] deleteItem backend success", { id });
        setItems((prev) => {
          const next = prev.filter((item) => item.id !== id && item.customId !== id);
          idbSet("cozy_items", next);
          return next;
        });
        setRentals((prev) => {
          const next = prev.filter((rental) => rental.itemId !== id);
          idbSet("cozy_rentals", next);
          return next;
        });
        console.info("[store] deleteItem state updated", { id });
      },
      deleteCustomer: async (id) => {
        console.info("[store] deleteCustomer started", { id });
        await customersApi.delete(id);
        console.info("[store] deleteCustomer backend success", { id });
        setCustomers((prev) => {
          const next = prev.filter((customer) => customer.id !== id && customer.customId !== id);
          idbSet("cozy_customers", next);
          return next;
        });
        console.info("[store] deleteCustomer state updated", { id });
      },
      updateCustomer: async (id, data) => {
        console.info("[store] updateCustomer started", { id, dataKeys: Object.keys(data || {}) });
        const updated = await customersApi.update(id, data);
        console.info("[store] updateCustomer backend response", updated);
        const transformed = transformCustomer(updated);
        setCustomers((prev) => {
          const next = prev.map((cust) => (cust.id === id || cust.customId === id ? transformed : cust));
          idbSet("cozy_customers", next);
          return next;
        });
        return transformed;
      },
      addCustomer: async (data) => {
        console.info("[store] addCustomer started", data);
        const branchToUse = data.branch || getEffectiveBranch();
        const newCustomer = await customersApi.create({ ...data, branch: branchToUse });
        console.info("[store] addCustomer backend response", newCustomer);
        const transformed = transformCustomer(newCustomer);
        setCustomers((prev) => {
          const next = [transformed, ...prev.filter((c) => c.id !== transformed.id && c.customId !== transformed.id)];
          idbSet("cozy_customers", next);
          return next;
        });
        console.info("[store] addCustomer state updated", transformed);
        return transformed;
      },
      addRental: async (data) => {
        console.info("[store] addRental started", data);
        const branchToUse = data.branch || getEffectiveBranch();
        const newRental = await rentalsApi.create({ ...data, branch: branchToUse });
        console.info("[store] addRental backend response", newRental);
        const transformed = transformRental(newRental);
        setRentals((prev) => {
          const next = [transformed, ...prev.filter((r) => r.id !== transformed.id && r.customId !== transformed.id)];
          idbSet("cozy_rentals", next);
          return next;
        });
        console.info("[store] addRental state updated", transformed);
        return transformed;
      },
      deleteRental: async (id) => {
        console.info("[store] deleteRental started", { id });
        await rentalsApi.delete(id);
        console.info("[store] deleteRental backend success", { id });
        setRentals((prev) => {
          const next = prev.filter((rental) => rental.id !== id && rental.customId !== id);
          idbSet("cozy_rentals", next);
          return next;
        });
        console.info("[store] deleteRental state updated", { id });
      },
      updateItem: async (id, data) => {
        console.info("[store] updateItem started", { id, dataKeys: Object.keys(data || {}) });
        const updated = await itemsApi.update(id, data);
        console.info("[store] updateItem backend response", updated);
        const transformed = transformItem(updated);
        setItems((prev) => {
          const next = prev.map((item) => (item.id === id || item.customId === id ? transformed : item));
          idbSet("cozy_items", next);
          return next;
        });
        return transformed;
      },
      updateRental: async (id, data) => {
        console.info("[store] updateRental started", { id, dataKeys: Object.keys(data || {}) });
        const updated = await rentalsApi.update(id, data);
        console.info("[store] updateRental backend response", updated);
        const transformed = transformRental(updated);
        setRentals((prev) => {
          const next = prev.map((rental) => (rental.id === id || rental.customId === id ? transformed : rental));
          idbSet("cozy_rentals", next);
          return next;
        });
        return transformed;
      },
      getItem: (id) => (id ? (itemMap.get(id) || items.find((i) => i.id === id || i.customId === id)) : undefined),
      getCustomer: (id) => (id ? (customerMap.get(id) || customers.find((c) => c.id === id || c.customId === id)) : undefined),
      refreshData,
    }),
    [items, customers, rentals, loading, searchQuery, selectedBranch, itemMap, customerMap, refreshData, getEffectiveBranch],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
