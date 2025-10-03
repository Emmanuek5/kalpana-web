import React from "react";

export const AgentIcon = ({ className = "h-24 w-24" }: { className?: string }) => {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Robot head/body */}
      <rect
        x="60"
        y="50"
        width="80"
        height="90"
        rx="12"
        fill="url(#gradient1)"
        stroke="currentColor"
        strokeWidth="3"
        className="text-emerald-500"
      />
      
      {/* Screen/face */}
      <rect
        x="70"
        y="65"
        width="60"
        height="40"
        rx="6"
        fill="#0a0e0d"
        stroke="currentColor"
        strokeWidth="2"
        className="text-emerald-400"
      />
      
      {/* Code lines on screen */}
      <line x1="80" y1="75" x2="110" y2="75" stroke="currentColor" strokeWidth="2" className="text-emerald-400" />
      <line x1="80" y1="85" x2="120" y2="85" stroke="currentColor" strokeWidth="2" className="text-emerald-400" />
      <line x1="80" y1="95" x2="105" y2="95" stroke="currentColor" strokeWidth="2" className="text-emerald-400" />
      
      {/* Eyes/indicators */}
      <circle cx="85" cy="120" r="4" fill="currentColor" className="text-emerald-400" />
      <circle cx="115" cy="120" r="4" fill="currentColor" className="text-emerald-400" />
      
      {/* Antenna */}
      <line x1="100" y1="50" x2="100" y2="35" stroke="currentColor" strokeWidth="3" className="text-emerald-500" />
      <circle cx="100" cy="30" r="5" fill="currentColor" className="text-emerald-400">
        <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
      </circle>
      
      {/* Message bubble */}
      <rect
        x="145"
        y="70"
        width="45"
        height="30"
        rx="8"
        fill="currentColor"
        className="text-emerald-500/20"
        stroke="currentColor"
        strokeWidth="2"
        className="text-emerald-500"
      />
      
      {/* Message bubble tail */}
      <path
        d="M 145 85 L 140 90 L 145 95"
        fill="currentColor"
        className="text-emerald-500/20"
        stroke="currentColor"
        strokeWidth="2"
        className="text-emerald-500"
      />
      
      {/* Code symbols in bubble */}
      <text x="155" y="88" fontSize="16" fill="currentColor" className="text-emerald-400" fontFamily="monospace">
        &lt;/&gt;
      </text>
      
      {/* Arms */}
      <rect x="45" y="80" width="15" height="30" rx="4" fill="currentColor" className="text-emerald-500/60" />
      <rect x="140" y="80" width="15" height="30" rx="4" fill="currentColor" className="text-emerald-500/60" />
      
      {/* Gradient definition */}
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgb(16 185 129 / 0.2)" />
          <stop offset="100%" stopColor="rgb(5 150 105 / 0.1)" />
        </linearGradient>
      </defs>
    </svg>
  );
};
