import { PasswordAuthForm } from '@/components/auth/PasswordAuthForm';
import Link from 'next/link';

export default function AgencyAuthPage() {
  return (
    <div className="flex flex-col gap-6">
      <PasswordAuthForm />
      
      <div className="pt-4 border-t border-gray-200">
        <Link
          href="/login"
          className="text-sm text-gray-600 hover:text-black transition-colors"
        >
          ← Назад к выбору
        </Link>
      </div>
    </div>
  );
}

