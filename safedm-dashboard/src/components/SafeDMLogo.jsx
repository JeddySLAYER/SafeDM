import fullLogo from "../assets/brand/full-logo.png";
import iconLogo from "../assets/brand/simplify-logo.png";

/**
 * Logo Safeguard DM (assets racine).
 * variant="icon" | "full"
 */
export default function SafeDMLogo({ size = 40, variant = "icon" }) {
  if (variant === "full") {
    const height = size;
    const width = Math.round(size * (512 / 128));
    return (
      <img
        src={fullLogo}
        width={width}
        height={height}
        alt="Safeguard DM"
        style={{
          display: "block",
          objectFit: "contain",
          borderRadius: Math.min(8, size * 0.12),
        }}
      />
    );
  }

  return (
    <img
      src={iconLogo}
      width={size}
      height={size}
      alt="Safeguard DM"
      style={{
        display: "block",
        objectFit: "contain",
        borderRadius: Math.min(10, size * 0.18),
      }}
    />
  );
}
