export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-lg border border-gray-300 shadow-sm">
          {children}
        </div>
        
        <footer className="mt-6 text-center text-sm text-gray-600">
          <p>ООО "Сектор ИТ" (ИНН 5190237491)</p>
          <p className="mt-1">hello@housler.ru</p>
        </footer>
      </div>
    </div>
  );
}

