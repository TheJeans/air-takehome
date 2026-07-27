import type { ComponentPropsWithoutRef } from "react";

export function CardGrid({
  children,
  ...rest
}: Omit<ComponentPropsWithoutRef<"ul">, "className">) {
  return (
    <ul
      role="list"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6"
      {...rest}
    >
      {children}
    </ul>
  );
}
