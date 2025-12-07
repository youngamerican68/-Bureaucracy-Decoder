import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-lg',
          }
        }}
      />
      <p className="mt-4 text-xs text-stone-500 text-center max-w-sm">
        By signing up, you agree to our{' '}
        <Link href="/terms" className="text-amber-600 hover:underline">
          Terms of Use
        </Link>
        . This service is for informational purposes only and does not constitute legal advice.
      </p>
    </div>
  );
}
