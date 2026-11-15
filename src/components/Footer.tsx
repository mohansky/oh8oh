import { Link } from '@tanstack/react-router'
import { CONTACT_EMAIL } from '../lib/site'

export default function Footer() {
  return (
    <footer className="border-t border-slate-700 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/about" className="hover:text-white transition-colors">
              About
            </Link>
            <Link
              to="/sources"
              className="hover:text-white transition-colors"
            >
              Sources
            </Link>
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
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
