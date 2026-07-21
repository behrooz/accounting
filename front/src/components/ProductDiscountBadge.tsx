type Props = {
  percent?: number;
  className?: string;
};

export default function ProductDiscountBadge({ percent, className = "" }: Props) {
  const value = percent ?? 0;
  if (value <= 0) return null;
  return (
    <span
      className={`absolute right-2 top-2 z-10 bg-[#d81b7a] px-2 py-1 text-xs font-bold leading-none text-white ${className}`}
    >
      -{value.toLocaleString("fa-IR")}٪
    </span>
  );
}
