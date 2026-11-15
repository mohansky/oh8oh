import { Link } from '@tanstack/react-router'

export default function Footer() {
  return (
    <footer className="border-t border-slate-700 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
          <div className="flex gap-6">
            <Link
              to="/sources"
              className="hover:text-white transition-colors"
            >
              Sources
            </Link>
            <a
              href="mailto:contact@oh8oh.com"
              className="hover:text-white transition-colors"
            >
              Contact Us
            </a>
          </div>
          <div className="text-gray-500">
            © {new Date().getFullYear()} oh eight oh
          </div>
        </div>
      </div>
    </footer>
  )
}
