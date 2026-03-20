import SubNavWrapper from "@public/components/admin/shared/SubNavWrapper";

export default function ScheduleLayout({ children }) {
  const scheduleNavItems = [
    {
      label: "Resumen",
      href: "/admin/schedule",
      icon: "layout-dashboard",
      exact: true,
    },
    {
      label: "Agenda",
      href: "/admin/schedule/calendar",
      icon: "calendar-days",
    },
    {
      label: "Diario",
      href: "/admin/schedule/daily",
      icon: "clipboard-list",
    },
  ];

  return (
    <>
      <SubNavWrapper
        items={scheduleNavItems}
      />
      {children}
    </>
  );
}