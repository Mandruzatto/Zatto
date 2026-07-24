'use client'

type NavUserProps = {
  fullName: string
  email: string
  roleLabel?: string
}

export function NavUser({ fullName, email, roleLabel }: NavUserProps) {
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

  return (
    <div className="mb-1.5 rounded-md px-2.5 py-2">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-200">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-zinc-200">{fullName}</p>
          <p className="truncate text-[11px] text-zinc-600">{email}</p>
          {roleLabel && <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-700">{roleLabel}</p>}
        </div>
      </div>
    </div>
  )
}
