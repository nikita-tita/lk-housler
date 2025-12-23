'use client';

import Link from 'next/link';

export default function LoginPage() {
  return (
    <div>
      <h1 className="auth-title">LK Housler</h1>
      <p className="auth-subtitle">Выберите способ входа</p>

      <div className="space-y-3">
        <Link href="agent" className="role-card">
          <div className="role-card-title">Я агент</div>
          <div className="role-card-desc">Вход через SMS для частных риелторов</div>
        </Link>

        <Link href="client" className="role-card">
          <div className="role-card-title">Я клиент</div>
          <div className="role-card-desc">Вход через Email для покупателей и продавцов</div>
        </Link>

        <Link href="agency" className="role-card">
          <div className="role-card-title">Я из агентства</div>
          <div className="role-card-desc">Вход через Email и пароль для сотрудников</div>
        </Link>
      </div>
    </div>
  );
}
