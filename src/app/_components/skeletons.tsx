export function AgentCardSkeleton() {
  return (
    <div className="flex h-[320px] flex-col overflow-hidden rounded-lg border p-4">
      <div className="h-48 rounded-lg bg-gray-100" />
      <div className="mt-4 flex flex-grow flex-col space-y-2">
        <div className="h-4 w-3/4 rounded bg-gray-100" />
        <div className="h-4 w-1/2 rounded bg-gray-100" />
        <div className="mt-auto flex items-center justify-between pt-4">
          <div className="h-4 w-16 rounded bg-gray-100" />
          <div className="h-4 w-16 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

export function BackroomCardSkeleton() {
  return (
    <div className="flex h-[320px] flex-col overflow-hidden rounded-lg border p-4">
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded bg-gray-100" />
        <div className="h-4 w-1/2 rounded bg-gray-100" />
      </div>
      <div className="mt-4 flex flex-grow flex-col space-y-2">
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="grid grid-cols-3 gap-x-2">
          <div className="h-16 rounded-md bg-gray-100" />
          <div className="h-16 rounded-md bg-gray-100" />
          <div className="h-16 rounded-md bg-gray-100" />
        </div>
      </div>
      <div className="mt-auto pt-4">
        <div className="h-8 w-full rounded bg-gray-100" />
      </div>
    </div>
  );
}
