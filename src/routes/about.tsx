import { Link, createFileRoute } from '@tanstack/react-router'
import { CONTACT_EMAIL } from '../lib/site'

export const Route = createFileRoute('/about')({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: 'About | oh eight oh' },
      {
        name: 'description',
        content:
          'oh8oh gathers upcoming events in Bangalore from venues and ticketing sites into one list.',
      },
    ],
  }),
})

function AboutPage() {
  return (
    <div className="py-12 px-6">
      <article className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-bold">About oh8oh</h1>
          <p className="text-lg text-muted-foreground">
            One list of what's on in Bangalore.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What this is</h2>
          <p className="text-muted-foreground leading-relaxed">
            Events in Bangalore are spread across venue websites and ticketing
            apps, and it is easy to miss something good because you didn't
            check the right one that week. oh8oh checks them for you and puts
            the upcoming events in one place, sorted by date. The name is 080,
            Bangalore's dialling code.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Where the events come from</h2>
          <p className="text-muted-foreground leading-relaxed">
            Listings are collected automatically, once a day, from the public
            pages of the venues and platforms on our{' '}
            <Link to="/sources" className="underline underline-offset-4 hover:text-foreground">
              sources page
            </Link>
            . When the same event appears on more than one site, we merge it
            into a single entry. Some events are added directly by their hosts
            and reviewed before they are listed.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Every event links back to the page it came from. That page is the
            authority: we don't sell tickets, and dates, prices and venues can
            change after we last checked. Please confirm the details there
            before you set out.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What you can do with an account</h2>
          <p className="text-muted-foreground leading-relaxed">
            Browsing needs no account. If you sign up you can bookmark events
            to come back to. Organisers can ask to become a host, which lets
            them submit their own events for listing.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Get in touch</h2>
          <p className="text-muted-foreground leading-relaxed">
            If a listing is wrong, if you run a venue and want your events
            included or taken down, or if you'd like to become a host, write to{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </article>
    </div>
  )
}
