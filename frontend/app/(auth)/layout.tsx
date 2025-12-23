export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-container">
      <div>
        <div className="auth-card">
          {children}
        </div>

        <div className="footer">
          <p>OOO "Сектор ИТ" (ИНН 5190237491)</p>
          <p>hello@housler.ru</p>
        </div>
      </div>
    </div>
  );
}
