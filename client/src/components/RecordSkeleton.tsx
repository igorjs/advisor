// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

export function RecordSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="h-5 w-2/5 rounded bg-gray-200" />
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full rounded bg-gray-100" />
            <div className="h-4 w-4/5 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
