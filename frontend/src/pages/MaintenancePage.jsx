import React, { useEffect, useState } from 'react';
import { Wrench, Zap, Sparkles, ArrowRight } from 'lucide-react';

const MaintenancePage = () => {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/10 animate-float"
            style={{
              width: `${Math.random() * 100 + 50}px`,
              height: `${Math.random() * 100 + 50}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 10 + 10}s`
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl w-full">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 md:p-12">
          {/* Animated Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-purple-500 to-pink-500 p-6 rounded-full animate-bounce-slow">
                <Wrench className="w-16 h-16 text-white" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-300 animate-spin-slow" />
            </div>
          </div>

          {/* Main Heading with Gradient */}
          <h1 className="text-4xl md:text-6xl font-black text-center mb-6 bg-gradient-to-r from-purple-200 via-pink-200 to-blue-200 text-transparent bg-clip-text animate-gradient">
            We're Leveling Up! 🚀
          </h1>

          {/* Subheading */}
          <div className="text-center mb-8">
            <p className="text-xl md:text-2xl text-white/90 font-semibold mb-4">
              Web App is undergoing a major update
            </p>
            <div className="flex items-center justify-center gap-2 text-lg text-white/80">
              <Zap className="w-5 h-5 text-yellow-300 animate-pulse" />
              <span>Please wait, while we enhance your experience</span>
              <Zap className="w-5 h-5 text-yellow-300 animate-pulse" />
            </div>
          </div>

          {/* Nura Auto Image */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-2xl blur-2xl opacity-30 animate-pulse"></div>
              <img 
                src="https://customer-assets.emergentagent.com/job_lead-management-4/artifacts/giqdvh5o_Nura%20Auto.png" 
                alt="Nura Auto" 
                className="relative w-64 md:w-96 h-auto rounded-2xl shadow-2xl animate-float"
              />
            </div>
          </div>

          {/* Loading Animation */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-3 h-3 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <p className="text-white/70 text-lg font-medium">
              Upgrading systems{dots}
            </p>
          </div>

          {/* Info Message */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
            <p className="text-center text-white/70 text-sm md:text-base">
              Sorry for the inconvenience. We're working hard to bring you amazing new features! 
              <br />
              <span className="text-purple-300 font-semibold">This won't take long.</span>
            </p>
          </div>

          {/* Footer Animation */}
          <div className="mt-8 flex items-center justify-center gap-2 text-white/60 text-sm animate-pulse">
            <ArrowRight className="w-4 h-4" />
            <span>Expected back soon</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Powered By */}
        <div className="text-center mt-6">
          <p className="text-white/50 text-sm font-medium">
            Powered by <span className="text-white/80 font-bold">Nura Pulse</span>
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
        }
        
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        .animate-float {
          animation: float 20s ease-in-out infinite;
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default MaintenancePage;
