import Link from 'next/link';

interface FooterProps {
  className?: string;
  variant?: 'default' | 'compact';
}

export default function Footer({ className = '', variant = 'default' }: FooterProps) {
  if (variant === 'compact') {
    return (
      <div className={`text-center space-y-2 ${className}`}>
        <div className="flex justify-center space-x-4 text-xs text-gray-500">
          <Link
            href="/privacy-policy"
            className="hover:text-gray-700 hover:underline"
          >
            プライバシーポリシー
          </Link>
          <span>|</span>
          <Link
            href="/terms-of-service"
            className="hover:text-gray-700 hover:underline"
          >
            利用規約
          </Link>
        </div>
      </div>
    );
  }

  return (
    <footer className={`pt-8 border-t border-gray-200 ${className}`}>
      <div className="flex flex-col items-center space-y-4">
        <div className="flex space-x-6 text-sm text-gray-500">
          <Link
            href="/privacy-policy"
            className="hover:text-gray-700 hover:underline"
          >
            プライバシーポリシー
          </Link>
          <Link
            href="/terms-of-service"
            className="hover:text-gray-700 hover:underline"
          >
            利用規約
          </Link>
        </div>
        <p className="text-xs text-gray-400">
          © 2025 Tukumana Lab. All rights reserved.
        </p>
      </div>
    </footer>
  );
}