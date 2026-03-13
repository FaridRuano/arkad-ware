'use client'
import React, { useEffect, useState } from 'react';
import AdminSideBar from './AdminSideBar';

const MOBILE_BREAKPOINT = 980;
const COLLAPSE_BREAKPOINT = 1200;

const AdminShell = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const mobile = width <= MOBILE_BREAKPOINT;

      setIsMobile(mobile);

      if (mobile) {
        setCollapsed(false);
        setIsMobileOpen(false);
      } else if (width <= COLLAPSE_BREAKPOINT) {
        setCollapsed(true);
        setIsMobileOpen(false);
      } else {
        setCollapsed(false);
        setIsMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      className={`admin 
        ${collapsed ? 'sidebar-collapsed' : ''} 
        ${isMobileOpen ? 'sidebar-mobile-open' : ''}`}
    >
      <AdminSideBar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobile={isMobile}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <div className="admin-content">
        {children}
      </div>
    </div>
  );
};

export default AdminShell;