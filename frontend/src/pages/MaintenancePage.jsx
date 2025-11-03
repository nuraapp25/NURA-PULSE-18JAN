import React, { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';

const MaintenancePage = () => {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#a9e50b' }}>
      {/* Main Content */}
      <div className="max-w-4xl w-full">
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl border-2 border-white/20 shadow-2xl p-8 md:p-12">
          {/* Simple Icon */}
          <div className="flex justify-center mb-8">
            <div className="p-6 rounded-full bg-white/20">
              <Wrench className="w-16 h-16 text-white" />
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-6xl font-black text-center mb-6 text-white">
            We're Leveling Up! 🚀
          </h1>

          {/* Subheading */}
          <div className="text-center mb-8">
            <p className="text-xl md:text-2xl text-white font-semibold mb-4">
              Web App is undergoing a major update
            </p>
            <p className="text-lg text-white/90">
              ⚡ Please wait, while we enhance your experience ⚡
            </p>
          </div>

          {/* Nura Auto Image */}
          <div className="flex justify-center mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_lead-management-4/artifacts/giqdvh5o_Nura%20Auto.png" 
              alt="Nura Auto" 
              className="w-64 md:w-96 h-auto rounded-2xl shadow-2xl"
            />
          </div>

          {/* Loading Animation */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-3 h-3 rounded-full bg-white animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <p className="text-white text-lg font-medium">
              Upgrading systems{dots}
            </p>
          </div>

          {/* Info Message */}
          <div className="border-2 border-white/30 rounded-xl p-6 bg-white/5">
            <p className="text-center text-white text-sm md:text-base">
              Sorry for the inconvenience. We're working hard to bring you amazing new features! 
              <br />
              <span className="font-bold">This won't take long.</span>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-white/90 text-sm">
            → Expected back soon →
          </div>
        </div>

        {/* Powered By */}
        <div className="text-center mt-6">
          <p className="text-white/80 text-sm font-medium">
            Powered by <span className="font-bold">Nura Pulse</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
