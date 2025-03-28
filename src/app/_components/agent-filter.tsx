"use client";

import { useState, useEffect } from "react";
import { Input } from "@/app/_components/ui/input";
import { Label } from "@/app/_components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/_components/ui/select";
import { Slider } from "@/app/_components/ui/slider";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/app/_components/ui/sheet";
import { Button } from "@/app/_components/ui/button";
import { debounce } from "lodash";

interface AgentFiltersProps {
  filters: {
    search: string;
    sortBy: "newest" | "oldest" | "priceHigh" | "priceLow" | "popular";
    minPrice: number;
    maxPrice: number;
    visibility?: "public" | "private" | undefined;
  };
  onFiltersChange: (filters: AgentFiltersProps["filters"]) => void;
}

export function AgentFilters({ filters, onFiltersChange }: AgentFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [sheetOpen, setSheetOpen] = useState(false);

  const debouncedSearch = debounce((value: string) => {
    onFiltersChange({ ...localFilters, search: value });
  }, 300);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const applySheetFilters = () => {
    onFiltersChange(localFilters);
    setSheetOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-9"
            value={localFilters.search}
            onChange={(e) => {
              setLocalFilters((prev) => ({ ...prev, search: e.target.value }));
              debouncedSearch(e.target.value);
            }}
          />
          {localFilters.search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
              onClick={() => {
                setLocalFilters((prev) => ({ ...prev, search: "" }));
                onFiltersChange({ ...localFilters, search: "" });
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex gap-4">
          <Select
            value={localFilters.sortBy}
            onValueChange={(value) => {
              const newFilters = {
                ...localFilters,
                sortBy: value as AgentFiltersProps["filters"]["sortBy"],
              };
              setLocalFilters(newFilters);
              onFiltersChange(newFilters);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="priceHigh">Price: High to Low</SelectItem>
              <SelectItem value="priceLow">Price: Low to High</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Agents</SheetTitle>
                <SheetDescription>
                  Refine your agent search using these filters
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 py-6">
                <div className="space-y-4">
                  <Label>Price Range</Label>
                  <Slider
                    value={[localFilters.minPrice, localFilters.maxPrice]}
                    onValueChange={(value) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        minPrice: value[0],
                        maxPrice: value[1],
                      }))
                    }
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>${localFilters.minPrice}</span>
                    <span>${localFilters.maxPrice}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select
                    value={localFilters.visibility ?? "all"}
                    onValueChange={(value) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        visibility:
                          value === "all"
                            ? undefined
                            : (value as "public" | "private"),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <SheetFooter>
                <Button onClick={applySheetFilters}>Apply Filters</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
