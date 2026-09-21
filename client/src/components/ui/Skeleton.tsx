import React from 'react';

interface SkeletonProps {
  className?: string;
  height?: string | number;
  width?: string | number;
  rounded?: string;
}

export function Skeleton({ className = '', height, width, rounded = 'rounded-lg' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${rounded} ${className}`}
      style={{ height, width }}
    />
  );
}

export function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 shrink-0" rounded="rounded-lg" />
          <Skeleton height={13} width={160} />
        </div>
      </td>
      <td className="px-5 py-3.5"><Skeleton height={12} width={90} /></td>
      <td className="px-5 py-3.5">
        <div className="flex flex-col gap-1.5">
          <Skeleton height={11} width={130} />
          <Skeleton height={11} width={100} />
        </div>
      </td>
      <td className="px-5 py-3.5"><Skeleton height={6} width={80} rounded="rounded-full" /></td>
      <td className="px-5 py-3.5"><Skeleton height={20} width={75} rounded="rounded-full" /></td>
      <td className="px-5 py-3.5"><Skeleton height={24} width={24} rounded="rounded-lg" /></td>
    </tr>
  );
}

export function SkeletonMetricCard() {
  return (
    <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <Skeleton height={12} width={80} rounded="rounded-full" />
        <Skeleton height={32} width={32} rounded="rounded-xl" />
      </div>
      <Skeleton height={32} width="50%" />
      <Skeleton height={10} width="40%" />
    </div>
  );
}

export function SkeletonMovementRow() {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-3.5 py-3">
        <div className="flex items-center gap-2">
          <Skeleton height={11} width={60} rounded="rounded-full" />
          <Skeleton height={13} width={160} />
        </div>
      </td>
      <td className="px-3.5 py-3"><Skeleton height={13} width={120} /></td>
      <td className="px-3.5 py-3 text-right"><Skeleton height={14} width={80} className="ml-auto" /></td>
      <td className="px-3.5 py-3"><Skeleton height={18} width={55} rounded="rounded-full" className="mx-auto" /></td>
    </tr>
  );
}
