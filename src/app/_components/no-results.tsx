import { SearchX } from "lucide-react";

interface NoResultsProps {
  type: "agents" | "backrooms";
  searchTerm?: string;
}

export function NoResults({ type, searchTerm }: NoResultsProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <SearchX className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-semibold">No {type} found</h3>
      <p className="text-sm text-muted-foreground">
        {searchTerm
          ? `No ${type} match your search for "${searchTerm}". Try adjusting your filters or search term.`
          : `No ${type} match your current filters. Try adjusting your filter settings.`}
      </p>
    </div>
  );
}
