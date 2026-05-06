import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <main className="w-full max-w-3xl rounded border border-[#d5dbdb] bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-[#16191f]">حسابداری ساده</h1>
        <p className="mt-3 text-[#545b64]">
          برای شروع، از بخش مدیریت محصولات استفاده کنید.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/products/manage"
            className="rounded bg-[#ec7211] px-5 py-4 text-center font-medium text-white transition hover:bg-[#eb5f07]"
          >
            مدیریت محصولات
          </Link>
          <Link
            href="/products"
            className="rounded border border-[#aab7b8] px-5 py-4 text-center font-medium text-[#16191f] transition hover:bg-[#f2f3f3]"
          >
            مشاهده گرید محصولات
          </Link>
        </div>
      </main>
    </div>
  );
}
