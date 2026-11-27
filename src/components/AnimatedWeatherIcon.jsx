import { useId } from 'react';
import { getWeatherVisual } from '../utils/weatherData';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function AnimatedWeatherIcon({ code, isDay = true, size = 36, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const visual = getWeatherVisual(code, isDay);
  const kind = visual.icon;
  const animate = !prefersReducedMotion();

  return (
    <svg
      aria-hidden="true"
      className={`wx-anim-icon wx-anim-icon--${kind} ${className}`.trim()}
      height={size}
      viewBox="0 0 64 64"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${uid}-sun`} x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id={`${uid}-cloud`} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="65%" stopColor="#e2f1ff" />
          <stop offset="100%" stopColor="#bddcf8" />
        </linearGradient>
        <linearGradient id={`${uid}-storm`} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="60%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id={`${uid}-moon`} x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#eab308" />
        </linearGradient>
        <linearGradient id={`${uid}-drop`} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      {kind === 'sun' && (
        <g>
          <circle cx="32" cy="32" fill="#fde047" opacity="0.28" r="22">
            {animate && <animate attributeName="r" dur="3.2s" repeatCount="indefinite" values="20;24;20" />}
            {animate && <animate attributeName="opacity" dur="3.2s" repeatCount="indefinite" values="0.22;0.38;0.22" />}
          </circle>
          <g stroke="#f59e0b" strokeLinecap="round" strokeWidth="3.2">
            {animate && <animateTransform attributeName="transform" dur="16s" from="0 32 32" repeatCount="indefinite" to="360 32 32" type="rotate" />}
            <line x1="32" x2="32" y1="6" y2="12" />
            <line x1="32" x2="32" y1="52" y2="58" />
            <line x1="6" x2="12" y1="32" y2="32" />
            <line x1="52" x2="58" y1="32" y2="32" />
            <line x1="13.6" x2="17.8" y1="13.6" y2="17.8" />
            <line x1="46.2" x2="50.4" y1="46.2" y2="50.4" />
            <line x1="50.4" x2="46.2" y1="13.6" y2="17.8" />
            <line x1="17.8" x2="13.6" y1="46.2" y2="50.4" />
          </g>
          <circle cx="32" cy="32" fill={`url(#${uid}-sun)`} r="14" />
        </g>
      )}

      {kind === 'partly' && (
        <g>
          <g>
            {animate && <animateTransform attributeName="transform" dur="20s" from="0 40 23" repeatCount="indefinite" to="360 40 23" type="rotate" />}
            <g stroke="#f59e0b" strokeLinecap="round" strokeWidth="2.6">
              <line x1="40" x2="40" y1="7" y2="11.5" />
              <line x1="56" x2="51.5" y1="23" y2="23" />
              <line x1="51.5" x2="48.5" y1="11.5" y2="14.5" />
              <line x1="28.5" x2="31.5" y1="11.5" y2="14.5" />
              <line x1="51.5" x2="48.5" y1="34.5" y2="31.5" />
            </g>
            <circle cx="40" cy="23" fill={`url(#${uid}-sun)`} r="10.5" />
          </g>
          <g>
            {animate && <animateTransform attributeName="transform" dur="3.6s" repeatCount="indefinite" type="translate" values="0 0; 0 -2.6; 0 0" />}
            <path
              d="M18 48h28a10 10 0 0 0 1.4-19.9A13.5 13.5 0 0 0 21.5 24 11.5 11.5 0 0 0 18 48Z"
              fill={`url(#${uid}-cloud)`}
              stroke="#93c5fd"
              strokeWidth="1.4"
            />
          </g>
        </g>
      )}

      {kind === 'moon' && (
        <g>
          <circle cx="32" cy="32" fill="#818cf8" opacity="0.2" r="21">
            {animate && <animate attributeName="r" dur="3.4s" repeatCount="indefinite" values="19;23;19" />}
          </circle>
          <g>
            {animate && <animateTransform attributeName="transform" dur="4s" repeatCount="indefinite" type="translate" values="0 0; 0 -2; 0 0" />}
            <path
              d="M38.5 14a16.5 16.5 0 1 0 11.8 28A13.5 13.5 0 0 1 38.5 14Z"
              fill={`url(#${uid}-moon)`}
            />
          </g>
          <circle cx="46" cy="18" fill="#fde047" r="2.2">
            {animate && <animate attributeName="opacity" dur="2.2s" repeatCount="indefinite" values="0.35;1;0.35" />}
          </circle>
          <circle cx="52" cy="28" fill="#c7d2fe" r="1.7">
            {animate && <animate attributeName="opacity" begin="0.6s" dur="2.2s" repeatCount="indefinite" values="0.35;1;0.35" />}
          </circle>
          <circle cx="18" cy="18" fill="#e0e7ff" r="1.6">
            {animate && <animate attributeName="opacity" begin="1.1s" dur="2.2s" repeatCount="indefinite" values="0.35;1;0.35" />}
          </circle>
        </g>
      )}

      {kind === 'cloudMoon' && (
        <g>
          <path d="M44 12a11.5 11.5 0 1 0 8.2 19.5A9.5 9.5 0 0 1 44 12Z" fill={`url(#${uid}-moon)`} />
          <circle cx="54" cy="15" fill="#fde047" r="1.8">
            {animate && <animate attributeName="opacity" dur="2.2s" repeatCount="indefinite" values="0.35;1;0.35" />}
          </circle>
          <circle cx="20" cy="15" fill="#a5b4fc" r="1.5">
            {animate && <animate attributeName="opacity" begin="0.7s" dur="2.2s" repeatCount="indefinite" values="0.35;1;0.35" />}
          </circle>
          <g>
            {animate && <animateTransform attributeName="transform" dur="3.8s" repeatCount="indefinite" type="translate" values="0 0; 0 -2.4; 0 0" />}
            <path
              d="M17 48h29a9.5 9.5 0 0 0 1.4-18.9A13 13 0 0 0 22 25.5 11 11 0 0 0 17 48Z"
              fill={`url(#${uid}-cloud)`}
              stroke="#93c5fd"
              strokeWidth="1.4"
            />
          </g>
        </g>
      )}

      {(kind === 'cloud' || kind === 'unknown') && (
        <g>
          <g>
            {animate && <animateTransform attributeName="transform" dur="4.8s" repeatCount="indefinite" type="translate" values="0 0; 3.5 0; 0 0" />}
            <path
              d="M27 36h22a7.5 7.5 0 0 0 1-14.9A10 10 0 0 0 30.8 18a8.5 8.5 0 0 0-3.8 18Z"
              fill="#cbd5e1"
              opacity="0.72"
            />
          </g>
          <g>
            {animate && <animateTransform attributeName="transform" dur="3.6s" repeatCount="indefinite" type="translate" values="0 0; 0 -2.5; 0 0" />}
            <path
              d="M16 48h31a10 10 0 0 0 1.5-19.9A13.5 13.5 0 0 0 22.4 24 11.5 11.5 0 0 0 16 48Z"
              fill={`url(#${uid}-cloud)`}
              stroke="#93c5fd"
              strokeWidth="1.4"
            />
          </g>
        </g>
      )}

      {kind === 'drizzle' && (
        <g>
          <g>
            {animate && <animateTransform attributeName="transform" dur="3.6s" repeatCount="indefinite" type="translate" values="0 0; 0 -2; 0 0" />}
            <path
              d="M16 40h31a9.5 9.5 0 0 0 1.4-18.9A13 13 0 0 0 22.8 17 11 11 0 0 0 16 40Z"
              fill={`url(#${uid}-cloud)`}
              stroke="#7dd3fc"
              strokeWidth="1.4"
            />
          </g>
          <g stroke={`url(#${uid}-drop)`} strokeLinecap="round" strokeWidth="2.6">
            {[{ x1: 23, x2: 21, y1: 45, y2: 51, begin: '0s' }, { x1: 33, x2: 31, y1: 46, y2: 52, begin: '0.45s' }, { x1: 43, x2: 41, y1: 45, y2: 51, begin: '0.9s' }].map((drop, idx) => (
              <line key={idx} x1={drop.x1} x2={drop.x2} y1={drop.y1} y2={drop.y2}>
                {animate && <animateTransform attributeName="transform" begin={drop.begin} dur="1.55s" repeatCount="indefinite" type="translate" values="1.5 -3; -2.5 6" />}
                {animate && <animate attributeName="opacity" begin={drop.begin} dur="1.55s" repeatCount="indefinite" values="0;1;1;0" />}
              </line>
            ))}
          </g>
        </g>
      )}

      {kind === 'rain' && (
        <g>
          <g>
            {animate && <animateTransform attributeName="transform" dur="3.4s" repeatCount="indefinite" type="translate" values="0 0; 0 -2; 0 0" />}
            <path
              d="M16 39h31a9.5 9.5 0 0 0 1.4-18.9A13 13 0 0 0 22.8 16 11 11 0 0 0 16 39Z"
              fill={`url(#${uid}-cloud)`}
              stroke="#38bdf8"
              strokeWidth="1.5"
            />
          </g>
          <g stroke={`url(#${uid}-drop)`} strokeLinecap="round" strokeWidth="3">
            {[{ x1: 21, x2: 18, y1: 43, y2: 52, begin: '0s' }, { x1: 30, x2: 27, y1: 44, y2: 54, begin: '0.28s' }, { x1: 39, x2: 36, y1: 43, y2: 52, begin: '0.56s' }, { x1: 47, x2: 44, y1: 44, y2: 53, begin: '0.84s' }].map((drop, idx) => (
              <line key={idx} x1={drop.x1} x2={drop.x2} y1={drop.y1} y2={drop.y2}>
                {animate && <animateTransform attributeName="transform" begin={drop.begin} dur="1.15s" repeatCount="indefinite" type="translate" values="1.5 -4; -2.5 7" />}
                {animate && <animate attributeName="opacity" begin={drop.begin} dur="1.15s" repeatCount="indefinite" values="0;1;1;0" />}
              </line>
            ))}
          </g>
        </g>
      )}

      {kind === 'storm' && (
        <g>
          <g>
            {animate && <animateTransform attributeName="transform" dur="3.2s" repeatCount="indefinite" type="translate" values="0 0; 0 -2; 0 0" />}
            <path
              d="M15 38h33a9.5 9.5 0 0 0 1.4-18.9A13 13 0 0 0 23.5 15 11 11 0 0 0 15 38Z"
              fill={`url(#${uid}-storm)`}
              stroke="#475569"
              strokeWidth="1.2"
            />
          </g>
          <polygon fill="#facc15" points="34,36 26,48 32,48 29,58 41,44 35,44" stroke="#ca8a04" strokeLinejoin="round" strokeWidth="0.9">
            {animate && <animate attributeName="opacity" dur="2.4s" repeatCount="indefinite" values="0.35;0.35;1;0.4;1;0.35" />}
          </polygon>
          <g stroke="#38bdf8" strokeLinecap="round" strokeWidth="2.6">
            {[{ x1: 21, x2: 18, y1: 42, y2: 50, begin: '0s' }, { x1: 45, x2: 42, y1: 42, y2: 50, begin: '0.55s' }].map((drop, idx) => (
              <line key={idx} x1={drop.x1} x2={drop.x2} y1={drop.y1} y2={drop.y2}>
                {animate && <animateTransform attributeName="transform" begin={drop.begin} dur="1.1s" repeatCount="indefinite" type="translate" values="1.5 -3; -2.5 6" />}
                {animate && <animate attributeName="opacity" begin={drop.begin} dur="1.1s" repeatCount="indefinite" values="0;1;1;0" />}
              </line>
            ))}
          </g>
        </g>
      )}

      {kind === 'fog' && (
        <g>
          <g>
            {animate && <animateTransform attributeName="transform" dur="3.8s" repeatCount="indefinite" type="translate" values="0 0; 0 -1.8; 0 0" />}
            <path
              d="M16 37h31a9 9 0 0 0 1.4-17.9A12.5 12.5 0 0 0 23.2 15.5 10.5 10.5 0 0 0 16 37Z"
              fill={`url(#${uid}-cloud)`}
              stroke="#94a3b8"
              strokeWidth="1.3"
            />
          </g>
          <g stroke="#94a3b8" strokeLinecap="round" strokeWidth="3">
            <line x1="14" x2="46" y1="44" y2="44">
              {animate && <animateTransform attributeName="transform" dur="3.2s" repeatCount="indefinite" type="translate" values="-2 0; 3 0; -2 0" />}
            </line>
            <line x1="20" x2="52" y1="51" y2="51">
              {animate && <animateTransform attributeName="transform" begin="0.8s" dur="3.2s" repeatCount="indefinite" type="translate" values="2 0; -3 0; 2 0" />}
            </line>
          </g>
        </g>
      )}

      {kind === 'snow' && (
        <g>
          <g>
            {animate && <animateTransform attributeName="transform" dur="3.8s" repeatCount="indefinite" type="translate" values="0 0; 0 -2; 0 0" />}
            <path
              d="M16 39h31a9.5 9.5 0 0 0 1.4-18.9A13 13 0 0 0 22.8 16 11 11 0 0 0 16 39Z"
              fill={`url(#${uid}-cloud)`}
              stroke="#7dd3fc"
              strokeWidth="1.4"
            />
          </g>
          <g fill="#38bdf8">
            {[{ cx: 22, cy: 46, r: 2.6, begin: '0s' }, { cx: 32, cy: 50, r: 2.8, begin: '0.6s' }, { cx: 42, cy: 46, r: 2.6, begin: '1.2s' }].map((flake, idx) => (
              <circle cx={flake.cx} cy={flake.cy} key={idx} r={flake.r}>
                {animate && <animateTransform attributeName="transform" begin={flake.begin} dur="2.2s" repeatCount="indefinite" type="translate" values="0 -3; 0 7" />}
                {animate && <animate attributeName="opacity" begin={flake.begin} dur="2.2s" repeatCount="indefinite" values="0;1;1;0" />}
              </circle>
            ))}
          </g>
        </g>
      )}
    </svg>
  );
}
