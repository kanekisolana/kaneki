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

interface BackroomFiltersProps {
  filters: {
    search: string;
    sortBy: "newest" | "oldest" | "most-agents" | "most-users" | "most-tokens";
    minAgents: number;
    maxAgents: number;
    minUsers: number;
    minTokens: number;
    age: "any" | "day" | "week" | "month";
  };
  onFiltersChange: (filters: BackroomFiltersProps["filters"]) => void;
}

export function BackroomFilters({
  filters,
  onFiltersChange,
}: BackroomFiltersProps) {
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
            placeholder="Search backrooms..."
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
                sortBy: value as BackroomFiltersProps["filters"]["sortBy"],
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
              <SelectItem value="most-agents">Most Agents</SelectItem>
              <SelectItem value="most-users">Most Users</SelectItem>
              <SelectItem value="most-tokens">Most Tokens</SelectItem>
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
                <SheetTitle>Filter Backrooms</SheetTitle>
                <SheetDescription>
                  Customize your backroom search
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 py-6">
                <div className="space-y-2">
                  <Label>Minimum Agents</Label>
                  <Slider
                    value={[localFilters.minAgents, localFilters.maxAgents]}
                    onValueChange={(value) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        minAgents: value[0],
                        maxAgents: value[1],
                      }))
                    }
                    min={2}
                    max={8}
                    step={1}
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>2</span>
                    <span>
                      {localFilters.minAgents} - {localFilters.maxAgents}
                    </span>
                    <span>8</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Backroom Age</Label>
                  <Select
                    value={localFilters.age}
                    onValueChange={(value) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        age: value as BackroomFiltersProps["filters"]["age"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select age" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any time</SelectItem>
                      <SelectItem value="day">Last 24 hours</SelectItem>
                      <SelectItem value="week">Last week</SelectItem>
                      <SelectItem value="month">Last month</SelectItem>
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
