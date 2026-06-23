
import React from 'react';

interface CustomLoaderProps {
  className?: string;
  scale?: number;
}

export const CustomLoader: React.FC<CustomLoaderProps> = ({ className = '', scale = 1 }) => {
  return (
    <div className={`fan-container ${className}`} style={{ transform: `scale(${scale})` }}>
      <svg className="fan-svg" viewBox="0 0 200 200">
        <rect
          x="70"
          y="160"
          width="60"
          height="10"
          rx="3"
          fill="url(#baseGradient)"
        ></rect>

        <rect
          x="95"
          y="80"
          width="10"
          height="80"
          fill="url(#standGradient)"
        ></rect>

        <circle cx="100" cy="80" r="25" fill="url(#motorGradient)"></circle>
        <circle cx="100" cy="80" r="15" fill="#333"></circle>

        <g className="fan-trails">
          <circle
            cx="100"
            cy="80"
            r="65"
            fill="none"
            stroke="url(#trailGradient)"
            strokeWidth="20"
            strokeDasharray="5,95"
            opacity="0.7"
          ></circle>
          <circle
            cx="100"
            cy="80"
            r="65"
            fill="none"
            stroke="url(#trailGradient)"
            strokeWidth="20"
            strokeDasharray="5,95"
            opacity="0.7"
            transform="rotate(120 100 80)"
          ></circle>
          <circle
            cx="100"
            cy="80"
            r="65"
            fill="none"
            stroke="url(#trailGradient)"
            strokeWidth="20"
            strokeDasharray="5,95"
            opacity="0.7"
            transform="rotate(240 100 80)"
          ></circle>
        </g>

        <g className="fan-blades">
          <path
            d="M100,80 C105,60 130,50 160,60 C170,65 170,75 160,80 C130,90 105,100 100,80 Z"
            fill="url(#bladeGradient)"
          ></path>
          <path
            d="M100,80 C105,60 130,50 160,60 C170,65 170,75 160,80 C130,90 105,100 100,80 Z"
            fill="url(#bladeGradient)"
            transform="rotate(120 100 80)"
          ></path>
          <path
            d="M100,80 C105,60 130,50 160,60 C170,65 170,75 160,80 C130,90 105,100 100,80 Z"
            fill="url(#bladeGradient)"
            transform="rotate(240 100 80)"
          ></path>
        </g>

        <circle
          cx="100"
          cy="80"
          r="22"
          fill="none"
          stroke="url(#grillGradient)"
          strokeWidth="2"
          strokeDasharray="3,3"
        ></circle>
        <circle
          cx="100"
          cy="80"
          r="15"
          fill="none"
          stroke="url(#grillGradient)"
          strokeWidth="2"
          strokeDasharray="3,3"
        ></circle>

        <defs>
          <linearGradient id="baseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5a5a5a"></stop>
            <stop offset="100%" stopColor="#2a2a2a"></stop>
          </linearGradient>
          <linearGradient id="standGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6a6a6a"></stop>
            <stop offset="100%" stopColor="#3a3a3a"></stop>
          </linearGradient>
          <radialGradient
            id="motorGradient"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <stop offset="0%" stopColor="#888"></stop>
            <stop offset="100%" stopColor="#444"></stop>
          </radialGradient>
          <linearGradient id="bladeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0e0e0"></stop>
            <stop offset="50%" stopColor="#c0c0c0"></stop>
            <stop offset="100%" stopColor="#a0a0a0"></stop>
          </linearGradient>
          <linearGradient id="grillGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#aaa"></stop>
            <stop offset="100%" stopColor="#666"></stop>
          </linearGradient>
          <linearGradient id="trailGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0e0e0" stopOpacity="0"></stop>
            <stop offset="50%" stopColor="#f0f0f0" stopOpacity="0.3"></stop>
            <stop offset="100%" stopColor="#e0e0e0" stopOpacity="0"></stop>
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
