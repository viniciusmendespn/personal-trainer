import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Clock } from 'lucide-react'
import LandingFooter from './LandingFooter'
import { renderInline, ProseList, ProseTable } from './prose'
import { BASE_URL } from './publicSeoData.js'
import { BLOG_POSTS, BLOG_BASE } from './blogData.js'
import type { BlogPost } from './blogData.js'

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function upsertMeta(selector: string, create: () => HTMLMetaElement | HTMLLinkElement, attr: string, value: string) {
  let el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

function useBlogMeta(title: string, description: string, path: string, post?: BlogPost) {
  useEffect(() => {
    const canonical = `${BASE_URL}${path}`
    document.title = title
    upsertMeta('meta[name="description"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('name', 'description')
      return el
    }, 'content', description)
    upsertMeta('link[rel="canonical"]', () => {
      const el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      return el
    }, 'href', canonical)
    upsertMeta('meta[property="og:title"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:title')
      return el
    }, 'content', title)
    upsertMeta('meta[property="og:description"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:description')
      return el
    }, 'content', description)
    upsertMeta('meta[property="og:url"]', () => {
      const el = document.createElement('meta')
      el.setAttribute('property', 'og:url')
      return el
    }, 'content', canonical)

    const graph: object[] = [
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'CoachPilot', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
          ...(post ? [{ '@type': 'ListItem', position: 3, name: post.h1, item: canonical }] : []),
        ],
      },
    ]
    if (post) {
      graph.push({
        '@type': 'BlogPosting',
        '@id': `${canonical}#article`,
        headline: post.h1,
        description: post.description,
        datePublished: post.datePublished,
        dateModified: post.dateModified,
        inLanguage: 'pt-BR',
        mainEntityOfPage: canonical,
        author: { '@type': 'Organization', name: 'CoachPilot', '@id': `${BASE_URL}/#organization` },
        publisher: { '@id': `${BASE_URL}/#organization` },
      })
      if (post.faqs.length > 0) {
        graph.push({
          '@type': 'FAQPage',
          '@id': `${canonical}#faq`,
          mainEntity: post.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a },
          })),
        })
      }
    } else {
      graph.push({
        '@type': 'Blog',
        '@id': `${canonical}#blog`,
        name: BLOG_BASE.title,
        description: BLOG_BASE.description,
        url: canonical,
        inLanguage: 'pt-BR',
        publisher: { '@id': `${BASE_URL}/#organization` },
      })
    }
    const schema = { '@context': 'https://schema.org', '@graph': graph }
    let script = document.querySelector('#page-json-ld') as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = 'page-json-ld'
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(schema)
    window.scrollTo(0, 0)
  }, [title, description, path, post])
}

function BlogHeader() {
  return (
    <header style={{ background: '#060a14', borderBottom: '1px solid rgba(20,184,166,0.14)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <img src="/novo-logo-slogan-semfundo.png" alt="CoachPilot" style={{ height: 52, width: 'auto' }} />
        </Link>
        <Link to="/blog" style={{ color: 'rgba(255,255,255,0.74)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
          <ArrowLeft size={15} /> Blog
        </Link>
      </div>
    </header>
  )
}

function CtaBox() {
  return (
    <div style={{ background: 'linear-gradient(160deg, #0f172a 0%, #060a14 100%)', borderRadius: 16, padding: '32px 28px', marginTop: 48 }}>
      <p style={{ color: '#14b8a6', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', marginBottom: 10 }}>CoachPilot</p>
      <p style={{ color: '#fff', fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Gestão de alunos, treinos e evolução em um só lugar
      </p>
      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
        Grátis para até 3 alunos, sem cartão. Monte treinos conversando com a IA e migre sua planilha sem redigitar.
      </p>
      <Link to="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #14b8a6, #10b981)', color: '#fff', textDecoration: 'none', fontWeight: 800, padding: '13px 20px', borderRadius: 10 }}>
        Começar grátis <ArrowRight size={17} />
      </Link>
    </div>
  )
}

export function BlogIndexPage() {
  useBlogMeta(BLOG_BASE.title, BLOG_BASE.description, BLOG_BASE.path)

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#0f172a' }}>
      <BlogHeader />
      <main>
        <section style={{ background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 55%, #060a14 100%)', padding: '64px 24px 56px' }}>
          <div style={{ maxWidth: 980, margin: '0 auto' }}>
            <p style={{ color: '#14b8a6', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', marginBottom: 16 }}>Conteúdo para personal trainers</p>
            <h1 style={{ fontFamily: "'Sora', sans-serif", color: '#fff', fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.1, marginBottom: 16 }}>{BLOG_BASE.h1}</h1>
            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 18, lineHeight: 1.7, maxWidth: 720 }}>{BLOG_BASE.intro}</p>
          </div>
        </section>

        <section style={{ padding: '56px 24px', background: '#f8fafc' }}>
          <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 18 }}>
            {BLOG_POSTS.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '26px 28px', display: 'block' }}>
                <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, color: '#0f172a', marginBottom: 10, lineHeight: 1.3 }}>{post.h1}</h2>
                <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.7, marginBottom: 14 }}>{post.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: '#64748b', fontSize: 13 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CalendarDays size={14} /> {formatDate(post.datePublished)}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> {post.readingMinutes} min de leitura</span>
                  <span style={{ color: '#0f766e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ler artigo <ArrowRight size={14} /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}

export function BlogPostPage() {
  const { slug } = useParams()
  const post = BLOG_POSTS.find((p) => p.slug === slug)
  useBlogMeta(post?.title ?? BLOG_BASE.title, post?.description ?? BLOG_BASE.description, post ? `/blog/${post.slug}` : BLOG_BASE.path, post)
  if (!post) return <Navigate to="/blog" replace />

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#0f172a' }}>
      <BlogHeader />
      <main>
        <section style={{ background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 55%, #060a14 100%)', padding: '64px 24px 56px' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <p style={{ color: '#14b8a6', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', marginBottom: 16 }}>Blog CoachPilot</p>
            <h1 style={{ fontFamily: "'Sora', sans-serif", color: '#fff', fontSize: 'clamp(30px, 4.5vw, 46px)', lineHeight: 1.15, marginBottom: 18 }}>{post.h1}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CalendarDays size={15} /> {formatDate(post.datePublished)}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={15} /> {post.readingMinutes} min de leitura</span>
            </div>
          </div>
        </section>

        <article style={{ padding: '56px 24px', background: '#fff' }}>
          <div style={{ maxWidth: 780, margin: '0 auto' }}>
            <p style={{ color: '#334155', fontSize: 18, lineHeight: 1.8, marginBottom: 36, fontWeight: 500 }}>{post.intro}</p>

            {post.sections.map((section) => (
              <section key={section.h2} style={{ marginBottom: 36 }}>
                <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 26, marginBottom: 14, lineHeight: 1.3 }}>{section.h2}</h2>
                {section.paragraphs.map((paragraph, i) => (
                  <p key={i} style={{ color: '#475569', fontSize: 16, lineHeight: 1.8, marginBottom: 14 }}>{renderInline(paragraph)}</p>
                ))}
                {section.list && <ProseList items={section.list} />}
                {section.table && <ProseTable table={section.table} />}
              </section>
            ))}

            {post.faqs.length > 0 && (
              <section style={{ marginTop: 44 }}>
                <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 26, marginBottom: 18 }}>Perguntas frequentes</h2>
                <div style={{ display: 'grid', gap: 14 }}>
                  {post.faqs.map((faq) => (
                    <div key={faq.q} style={{ background: '#f0fdfa', border: '1px solid rgba(20,184,166,0.18)', borderRadius: 12, padding: 22 }}>
                      <h3 style={{ fontSize: 17, marginBottom: 8 }}>{faq.q}</h3>
                      <p style={{ color: '#475569', lineHeight: 1.7 }}>{faq.a}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section style={{ marginTop: 44 }}>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, marginBottom: 16 }}>Leia também</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {post.related.map((rel) => (
                  <Link key={rel.to} to={rel.to} style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 700, background: '#f0fdfa', border: '1px solid rgba(20,184,166,0.22)', borderRadius: 999, padding: '10px 14px' }}>
                    {rel.label}
                  </Link>
                ))}
              </div>
            </section>

            <CtaBox />
          </div>
        </article>
      </main>
      <LandingFooter />
    </div>
  )
}
