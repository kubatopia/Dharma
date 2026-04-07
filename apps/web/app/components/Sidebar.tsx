"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" fillOpacity="0.8" />
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" fillOpacity="0.8" />
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor" fillOpacity="0.8" />
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor" fillOpacity="0.8" />
      </svg>
    ),
  },
  {
    label: "Metrics",
    href: "/metrics",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="7" width="3" height="7" rx="0.75" fill="currentColor" fillOpacity="0.8" />
        <rect x="6" y="4" width="3" height="10" rx="0.75" fill="currentColor" fillOpacity="0.8" />
        <rect x="11" y="1" width="3" height="13" rx="0.75" fill="currentColor" fillOpacity="0.8" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm0-1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
          fill="currentColor"
          fillOpacity="0.8"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6.073 1.26a.5.5 0 0 1 .491-.26h1.872a.5.5 0 0 1 .49.26l.34.68a5.405 5.405 0 0 1 .9.522l.745-.15a.5.5 0 0 1 .538.237l.936 1.621a.5.5 0 0 1-.063.583l-.513.57a5.5 5.5 0 0 1 0 1.054l.513.57a.5.5 0 0 1 .063.583L10.449 8.35a.5.5 0 0 1-.538.238l-.745-.15a5.405 5.405 0 0 1-.9.521l-.34.681a.5.5 0 0 1-.49.26H5.564a.5.5 0 0 1-.491-.26l-.34-.68a5.405 5.405 0 0 1-.9-.522l-.745.15a.5.5 0 0 1-.538-.237L1.614 7.73a.5.5 0 0 1 .063-.583l.513-.57a5.5 5.5 0 0 1 0-1.054l-.513-.57a.5.5 0 0 1-.063-.583L2.55 2.75a.5.5 0 0 1 .538-.238l.745.15a5.405 5.405 0 0 1 .9-.521l.34-.681z"
          fill="currentColor"
          fillOpacity="0.8"
        />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? "bg-white/[0.08] text-white"
                : "text-white/35 hover:text-white/65 hover:bg-white/[0.04]"
            }`}
          >
            <span className={active ? "text-white" : "text-white/35"}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
