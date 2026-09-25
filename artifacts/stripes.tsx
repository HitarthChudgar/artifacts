export const meta = { title: "stripes", width: 300, height: 400 };

export default function Stripes() {
  const rows = Array.from({ length: 28 });
  return (
    <div className="flex h-full w-full flex-col justify-between overflow-hidden bg-yellow-200 py-2">
      {rows.map((_, i) => {
        const t = Math.sin((i / rows.length) * Math.PI);
        return (
          <div
            key={i}
            className="mx-auto h-2.5 rounded-full bg-black"
            style={{ width: `${30 + t * 65}%`, transform: `translateX(${Math.cos(i / 3) * 12}%)` }}
          />
        );
      })}
    </div>
  );
}
