export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-nero px-4 py-6 text-center text-sm text-[rgba(255,255,255,0.65)]">
      <p className="font-semibold text-water-leaf">Clabane Academy</p>
      <p className="mt-1 italic text-water-leaf">We Love African Skin</p>
      <p className="mt-2">&copy; {year} Clabane Skin Care. All rights reserved.</p>
    </footer>
  );
}
