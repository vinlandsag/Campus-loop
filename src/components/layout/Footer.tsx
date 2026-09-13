import Image from 'next/image'
import Link from 'next/link'
import { Github, Twitter, Linkedin } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'

const FOOTER_LINKS = {
  Platform: [
    { href: '/events', label: 'Browse Events' },
    { href: '/dashboard', label: 'My Dashboard' },
    { href: '/signup', label: 'Get Started' },
  ],
  Organizers: [
    { href: '/dashboard', label: 'Organizer Hub' },
    { href: '/dashboard/events/new', label: 'Create Event' },
  ],
  Company: [
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
  ],
} as const

const SOCIAL_LINKS = [
  { href: 'https://github.com', label: 'GitHub', Icon: Github },
  { href: 'https://twitter.com', label: 'Twitter / X', Icon: Twitter },
  { href: 'https://linkedin.com', label: 'LinkedIn', Icon: Linkedin },
] as const

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer
      className="mt-auto border-t border-[--border-subtle] bg-[--bg-surface]"
      aria-label="Site footer"
    >
      <div className="container-page py-12 md:py-16">
        {/* Top — brand + nav columns */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 font-display text-base font-bold transition-opacity hover:opacity-85"
              aria-label={`${APP_NAME} — home`}
            >
              <Image
                src="/logo-icon.png"
                alt="CampusLoop Logo"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
              <span className="text-[--text-primary]">
                Campus<span className="text-[--accent-500]">Loop</span>
              </span>
            </Link>
            <p className="mt-3 max-w-[200px] text-sm text-[--text-muted]">
              Discover and join events that shape your campus life.
            </p>

            {/* Social links */}
            <div className="mt-4 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ href, label, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[--text-muted] transition-colors hover:bg-[--bg-muted] hover:text-[--text-primary]"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[--text-muted]">
                {heading}
              </p>
              <ul className="space-y-2" role="list">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[--text-secondary] transition-colors hover:text-[--text-primary]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom — copyright */}
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-[--border-subtle] pt-6 text-xs text-[--text-muted] sm:flex-row sm:items-center">
          <p>© {year} {APP_NAME}. All rights reserved.</p>
          <p>Built for campus communities.</p>
        </div>
      </div>
    </footer>
  )
}
