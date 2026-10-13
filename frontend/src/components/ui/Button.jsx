import { Spinner } from "./Spinner";

export function Button({
  children,
  variant = "primary",
  size,
  block,
  loading = false,
  type = "button",
  className = "",
  disabled,
  ...rest
}) {
  const classes = [
    "btn",
    `btn--${variant}`,
    size === "sm" ? "btn--sm" : "",
    block ? "btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
