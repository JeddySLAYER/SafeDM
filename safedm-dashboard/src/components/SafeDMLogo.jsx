/** Logo icône SafeDM — cercle + 3 segments (signal) */
export default function SafeDMLogo({ size = 40, color = "#2F8AF2" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="SafeDM"
      role="img"
    >
      <circle cx="32" cy="36" r="12" fill={color} />
      <rect
        x="28"
        y="8"
        width="8"
        height="12"
        rx="2"
        fill={color}
        transform="rotate(0 32 14)"
      />
      <rect
        x="28"
        y="8"
        width="8"
        height="12"
        rx="2"
        fill={color}
        transform="rotate(-40 32 36)"
      />
      <rect
        x="28"
        y="8"
        width="8"
        height="12"
        rx="2"
        fill={color}
        transform="rotate(40 32 36)"
      />
    </svg>
  );
}
