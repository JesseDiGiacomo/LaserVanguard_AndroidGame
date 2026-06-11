/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface ArcadeCRTProps {
  children: React.ReactNode;
  enabled: boolean;
}

export function ArcadeCRT({ children, enabled }: ArcadeCRTProps) {
  if (!enabled) {
    return <div className="relative w-full h-full overflow-hidden">{children}</div>;
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none rounded-xl border-4 border-slate-700 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
      {/* Curved CRT reflection glass layer */}
      <div 
        id="crt-reflection"
        className="pointer-events-none absolute inset-0 z-30 opacity-12 bg-radial-[circle_at_center,rgba(255,255,255,0.15)_0%,rgba(0,0,0,0.35)_100%]"
      />

      {/* Screen scanlines - linear gradient repeating rows of dark shade */}
      <div 
        id="crt-scanlines"
        className="pointer-events-none absolute inset-0 z-20 opacity-25"
        style={{
          backgroundImage: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.45) 50%)",
          backgroundSize: "100% 4px",
        }}
      />

      {/* Retro Phosphor Glow & Grille Overlay */}
      <div
        id="crt-grille"
        className="pointer-events-none absolute inset-0 z-20 opacity-[0.06]"
        style={{
          backgroundImage: "linear-gradient(90deg, rgba(255, 0, 0, 0.6) 0%, rgba(0, 255, 0, 0.6) 33%, rgba(0, 0, 255, 0.6) 66%, rgba(255, 255, 255, 0.6) 100%)",
          backgroundSize: "4px 100%",
        }}
      />

      {/* CRT Vignette/Bezel Drop shadow */}
      <div 
        id="crt-bezel-shadow"
        className="pointer-events-none absolute inset-0 z-25 shadow-[inset_0_0_40px_rgba(0,0,0,0.85)]"
      />

      {/* Subtle Cathode Flicker Keyframes Animation */}
      <div className="w-full h-full animate-[flicker_0.15s_infinite] overflow-hidden">
        {children}
      </div>

      {/* CSS style injection for the flicker and CRT bezel curves */}
      <style>{`
        @keyframes flicker {
          0% { opacity: 0.992; }
          50% { opacity: 0.985; }
          100% { opacity: 0.992; }
        }
      `}</style>
    </div>
  );
}
