export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-gray)] py-12 px-4">
      <div className="w-full max-w-2xl">
        {children}

        <div className="text-center mt-8 text-sm text-[var(--color-text-light)]">
          <p>OOO &ldquo;Сектор ИТ&rdquo; (ИНН 5190237491)</p>
          <p>hello@housler.ru</p>
        </div>
      </div>
    </div>
  );
}
