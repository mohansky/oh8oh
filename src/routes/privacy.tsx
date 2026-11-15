import { Link, createFileRoute } from '@tanstack/react-router'
import { CONTACT_EMAIL } from '../lib/site'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: 'Privacy | oh eight oh' },
      {
        name: 'description',
        content:
          'What oh8oh stores about you, why, who processes it, and how to delete it.',
      },
    ],
  }),
})

const LAST_UPDATED = '15 November 2026'

function PrivacyPage() {
  const link = 'underline underline-offset-4 hover:text-foreground'

  return (
    <div className="py-12 px-6">
      <article className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-bold">Privacy</h1>
          <p className="text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
          <p className="text-lg text-muted-foreground">
            You can browse oh8oh without an account, and we don't run
            advertising or analytics trackers. If you create an account, this
            is what we keep and why.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What we store</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
            <li>
              <strong className="text-foreground">Your account:</strong> your
              name, email address, and your password in hashed form (we cannot
              read it). We also keep whether your email is verified, your role,
              and your time-format preference.
            </li>
            <li>
              <strong className="text-foreground">Your sign-ins:</strong> for
              each active session, the IP address and browser it was started
              from, so a session can be recognised and ended. Sessions expire
              after seven days of inactivity.
            </li>
            <li>
              <strong className="text-foreground">Your bookmarks:</strong> a
              copy of each event you save.
            </li>
            <li>
              <strong className="text-foreground">Events you submit:</strong>{' '}
              if you are a host, the details and any image you upload. Once
              approved, these are public.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What we use it for</h2>
          <p className="text-muted-foreground leading-relaxed">
            Only to run the site: signing you in, sending the emails you ask
            for (verifying your address, resetting your password), showing your
            bookmarks, and listing events you submit. We don't sell your
            information or use it for marketing.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Cookies and browser storage</h2>
          <p className="text-muted-foreground leading-relaxed">
            Signing in sets a session cookie, which is what keeps you signed
            in. Your browser also remembers two settings locally: light or dark
            theme, and whether you dismissed the "install app" prompt. If you
            install the app, your browser keeps a copy of pages and images so
            they load faster. None of this is used to track you across sites.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Who else is involved</h2>
          <p className="text-muted-foreground leading-relaxed">
            We rely on a few companies to run the site, and they process data
            on our behalf:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
            <li>
              <strong className="text-foreground">Cloudflare</strong> hosts the
              site and stores uploaded images. Like any web host, it sees the
              IP address of every request.
            </li>
            <li>
              <strong className="text-foreground">Turso</strong> hosts the
              database.
            </li>
            <li>
              <strong className="text-foreground">Resend</strong> delivers our
              emails, so it receives your email address when we send you one.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Event images are loaded directly from the site each event came
            from, so that site sees your request for the image. Following an
            event's link takes you to that site, where its own privacy policy
            applies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Deleting your data</h2>
          <p className="text-muted-foreground leading-relaxed">
            You can delete your account from your{' '}
            <Link to="/profile" className={link}>
              profile page
            </Link>
            . That removes your account, your sessions, your bookmarks and any
            events you submitted. You can also change your name and password
            there. If you can't sign in, email us and we'll delete it for you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Questions</h2>
          <p className="text-muted-foreground leading-relaxed">
            Write to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
              {CONTACT_EMAIL}
            </a>
            . If this page changes in a way that matters, we'll update the date
            at the top.
          </p>
        </section>
      </article>
    </div>
  )
}
