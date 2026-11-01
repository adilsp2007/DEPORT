import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Toast from '../components/Toast';
import { useShop } from '../context/ShopContext';

export const MainLayout = () => {
  const { toast } = useShop();

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0] text-[#1E1B18] font-sans">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};

export default MainLayout;
