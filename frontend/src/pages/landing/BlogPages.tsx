import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Search,
  ChevronRight,
  BookOpen,
} from 'lucide-react'
import LandingFooter from './LandingFooter'
import LandingNavbar from './LandingNavbar'
import CtaSection from './CtaSection'
import { blogPresentation, BLOG_CATEGORIES } from './blogPresentation.js'
import './public-site.css'
import { renderInline, ProseList, ProseTable } from './prose'
import { BASE_URL } from './publicSeoData.js'
import { BLOG_POSTS, BLOG_BASE } from './blogData.js'
import type { BlogPost } from './blogData.js'

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function upsertMeta(
  selector: string,
  create: () => HTMLMetaElement | HTMLLinkElement,
  attr: string,
  value: string,
) {
  let el = document.querySelector(selector) as
    | HTMLMetaElement
    | HTMLLinkElement
    | null
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

function useBlogMeta(
  title: string,
  description: string,
  path: string,
  post?: BlogPost,
) {
  useEffect(() => {
    const canonical = `${BASE_URL}${path}`
    document.title = title
    upsertMeta(
      'meta[name="description"]',
      () => {
        const el = document.createElement('meta')
        el.setAttribute('name', 'description')
        return el
      },
      'content',
      description,
    )
    upsertMeta(
      'link[rel="canonical"]',
      () => {
        const el = document.createElement('link')
        el.setAttribute('rel', 'canonical')
        return el
      },
      'href',
      canonical,
    )
    upsertMeta(
      'meta[property="og:title"]',
      () => {
        const el = document.createElement('meta')
        el.setAttribute('property', 'og:title')
        return el
      },
      'content',
      title,
    )
    upsertMeta(
      'meta[property="og:description"]',
      () => {
        const el = document.createElement('meta')
        el.setAttribute('property', 'og:description')
        return el
      },
      'content',
      description,
    )
    upsertMeta(
      'meta[property="og:url"]',
      () => {
        const el = document.createElement('meta')
        el.setAttribute('property', 'og:url')
        return el
      },
      'content',
      canonical,
    )

    const cover = BASE_URL + blogPresentation(post?.slug ?? '').image
    for (const [property, value] of [
      ['og:image', cover],
      ['og:type', post ? 'article' : 'website'],
      ['og:image:alt', blogPresentation(post?.slug ?? '').alt],
      ['twitter:image', cover],
    ]) {
      const attr = property.startsWith('twitter:') ? 'name' : 'property'
      upsertMeta(
        'meta[' + attr + '="' + property + '"]',
        () => {
          const el = document.createElement('meta')
          el.setAttribute(attr, property)
          return el
        },
        'content',
        value,
      )
    }
    const graph: object[] = [
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'CoachPilot',
            item: BASE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: `${BASE_URL}/blog`,
          },
          ...(post
            ? [
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: post.h1,
                  item: canonical,
                },
              ]
            : []),
        ],
      },
    ]
    if (post) {
      graph.push({
        '@type': 'BlogPosting',
        '@id': `${canonical}#article`,
        headline: post.h1,
        image: cover,
        description: post.description,
        datePublished: post.datePublished,
        dateModified: post.dateModified,
        inLanguage: 'pt-BR',
        mainEntityOfPage: canonical,
        author: {
          '@type': 'Organization',
          name: 'CoachPilot',
          '@id': `${BASE_URL}/#organization`,
        },
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
    let script = document.querySelector(
      '#page-json-ld',
    ) as HTMLScriptElement | null
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

function PostMeta({ post }: { post: BlogPost }) {
  return (
    <div className="cp-post-meta">
      <span>
        <CalendarDays size={13} />
        <time dateTime={post.datePublished}>
          {formatDate(post.datePublished)}
        </time>
      </span>
      <span>
        <Clock size={13} />
        {post.readingMinutes} min de leitura
      </span>
    </div>
  )
}

export function BlogCard({ post }: { post: BlogPost }) {
  const visual = blogPresentation(post.slug)
  return (
    <Link className="cp-article-card" to={'/blog/' + post.slug}>
      <img
        src={visual.image}
        alt={visual.alt}
        width="1536"
        height="1024"
        loading="lazy"
      />
      <span className="cp-category">{visual.category}</span>
      <h2>{post.h1}</h2>
      <p>{post.description}</p>
      <PostMeta post={post} />
    </Link>
  )
}

export function BlogIndexPage() {
  useBlogMeta(BLOG_BASE.title, BLOG_BASE.description, BLOG_BASE.path)
  const [category, setCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const featured = BLOG_POSTS[0]
  const visual = blogPresentation(featured.slug)
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
  const filtered = BLOG_POSTS.filter(
    (post) =>
      (category === 'Todos' ||
        blogPresentation(post.slug).category === category) &&
      normalize(post.h1 + ' ' + post.description).includes(normalize(search)),
  )
  return (
    <div className="cp-public">
      <a className="cp-skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <LandingNavbar />
      <main id="conteudo">
        <section className="cp-blog-hero">
          <div className="cp-container">
            <p className="cp-eyebrow">Blog CoachPilot</p>
            <h1 className="cp-heading">
              Conhecimento para
              <br />o seu próximo nível.
            </h1>
            <p className="cp-subtitle">
              Gestão, tecnologia e prática profissional. Conteúdo para quem quer
              cuidar melhor dos alunos e fazer o próprio negócio evoluir.
            </p>
          </div>
        </section>
        <section className="cp-container" aria-label="Artigos do blog">
          <Link className="cp-blog-featured" to={'/blog/' + featured.slug}>
            <img
              src={visual.image}
              alt={visual.alt}
              width="1536"
              height="1024"
              fetchPriority="high"
            />
            <div className="cp-blog-featured-copy">
              <span className="cp-eyebrow" style={{ marginBottom: 10 }}>
                Leitura em destaque
              </span>
              <span className="cp-category">{visual.category}</span>
              <h2>{featured.h1}</h2>
              <p>{featured.description}</p>
              <PostMeta post={featured} />
              <span className="cp-text-link" style={{ marginTop: 25 }}>
                Ler artigo completo <ArrowRight size={15} />
              </span>
            </div>
          </Link>
          <div className="cp-blog-toolbar">
            <div className="cp-blog-filters" aria-label="Filtrar por assunto">
              {BLOG_CATEGORIES.map((item) => (
                <button
                  key={item}
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="cp-blog-search">
              <Search size={16} />
              <input
                type="search"
                placeholder="Buscar um assunto..."
                aria-label="Buscar artigos"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          <p
            className="cp-fine-print"
            role="status"
            style={{ margin: '0 0 24px' }}
          >
            {filtered.length}{' '}
            {filtered.length === 1
              ? 'artigo encontrado'
              : 'artigos encontrados'}
          </p>
          {filtered.length ? (
            <div className="cp-blog-grid">
              {filtered.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <div className="cp-blog-empty">
              <h2>Nenhum artigo encontrado.</h2>
              <p>Tente outro termo ou explore todos os assuntos.</p>
              <button
                className="cp-button cp-button-light"
                style={{ marginTop: 20 }}
                onClick={() => {
                  setCategory('Todos')
                  setSearch('')
                }}
              >
                Ver todos os artigos
              </button>
            </div>
          )}
        </section>
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}

export function BlogPostPage() {
  const { slug } = useParams()
  const post = BLOG_POSTS.find((p) => p.slug === slug)
  const progress = useRef<HTMLDivElement>(null)
  const article = useRef<HTMLElement>(null)
  useBlogMeta(
    post?.title ?? BLOG_BASE.title,
    post?.description ?? BLOG_BASE.description,
    post ? '/blog/' + post.slug : BLOG_BASE.path,
    post,
  )
  useEffect(() => {
    const update = () => {
      if (!progress.current || !article.current) return
      const start = article.current.offsetTop
      const length = article.current.offsetHeight - window.innerHeight
      const value = Math.max(
        0,
        Math.min(1, (window.scrollY - start) / Math.max(1, length)),
      )
      progress.current.style.transform = 'scaleX(' + value + ')'
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [slug])
  if (!post) return <Navigate to="/blog" replace />
  const visual = blogPresentation(post.slug)
  const related = BLOG_POSTS.filter(
    (item) =>
      item.slug !== post.slug &&
      blogPresentation(item.slug).category === visual.category,
  ).slice(0, 3)
  return (
    <div className="cp-public">
      <a className="cp-skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <LandingNavbar />
      <div
        className="cp-reading-progress"
        ref={progress}
        style={{ transform: 'scaleX(0)' }}
        aria-hidden="true"
      />
      <main id="conteudo">
        <section className="cp-blog-hero">
          <div className="cp-container">
            <nav className="cp-breadcrumb" aria-label="Você está aqui">
              <Link to="/">CoachPilot</Link>
              <ChevronRight size={12} />
              <Link to="/blog">Blog</Link>
              <ChevronRight size={12} />
              <span>{visual.category}</span>
            </nav>
            <span className="cp-category">{visual.category}</span>
            <h1 className="cp-article-title">{post.h1}</h1>
            <p className="cp-article-standfirst">{post.description}</p>
            <PostMeta post={post} />
            <div className="cp-author">
              <span className="cp-author-mark">
                <BookOpen size={17} />
              </span>
              <div>
                <strong>Equipe CoachPilot</strong>
                <small>
                  Atualizado em{' '}
                  <time dateTime={post.dateModified}>
                    {formatDate(post.dateModified)}
                  </time>
                </small>
              </div>
            </div>
          </div>
        </section>
        <div className="cp-container">
          <div className="cp-article-layout">
            <article className="cp-article-body" ref={article}>
              <img
                className="cp-article-cover"
                src={visual.image}
                alt={visual.alt}
                width="1536"
                height="1024"
                fetchPriority="high"
              />
              <p>{post.intro}</p>
              <details className="cp-mobile-toc">
                <summary>Neste artigo</summary>
                <nav
                  className="cp-toc"
                  aria-label="Índice do artigo no celular"
                >
                  {post.sections.map((section, i) => (
                    <a href={'#secao-' + i} key={section.h2}>
                      {section.h2}
                    </a>
                  ))}
                </nav>
              </details>
              {post.sections.map((section, i) => (
                <section
                  className="cp-article-section"
                  key={section.h2}
                  id={'secao-' + i}
                >
                  <h2>{section.h2}</h2>
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={index}>{renderInline(paragraph)}</p>
                  ))}
                  {section.list && <ProseList items={section.list} />}
                  {section.table && <ProseTable table={section.table} />}
                </section>
              ))}
              {post.faqs.length > 0 && (
                <section id="perguntas" className="cp-article-section">
                  <h2>Perguntas frequentes</h2>
                  <div className="cp-faq-list">
                    {post.faqs.map((faq) => (
                      <details key={faq.q}>
                        <summary>{faq.q}</summary>
                        <p>{faq.a}</p>
                      </details>
                    ))}
                  </div>
                </section>
              )}
              <section
                className="cp-article-section"
                style={{ borderTop: '1px solid #dfe6e1', paddingTop: 26 }}
              >
                <h2>Continue explorando</h2>
                <div className="cp-related-links">
                  {post.related.map((rel) => (
                    <Link key={rel.to} to={rel.to}>
                      {rel.label} ↗
                    </Link>
                  ))}
                </div>
              </section>
            </article>
            <aside className="cp-article-aside">
              <h2>Neste artigo</h2>
              <nav className="cp-toc" aria-label="Índice do artigo">
                {post.sections.map((section, i) => (
                  <a href={'#secao-' + i} key={section.h2}>
                    {section.h2}
                  </a>
                ))}
                {post.faqs.length > 0 && (
                  <a href="#perguntas">Perguntas frequentes</a>
                )}
              </nav>
              <div className="cp-aside-cta">
                <h3>
                  Leve essas ideias
                  <br />
                  para a sua rotina.
                </h3>
                <p>
                  Organize alunos, treinos e evolução. Comece grátis para até 3
                  alunos, sem cartão.
                </p>
                <Link className="cp-button" to="/signup">
                  Conhecer o CoachPilot <ArrowRight size={14} />
                </Link>
              </div>
            </aside>
          </div>
        </div>
        {related.length > 0 && (
          <section className="cp-section cp-soft">
            <div className="cp-container">
              <div className="cp-section-head">
                <div>
                  <p className="cp-eyebrow">Mais sobre o assunto</p>
                  <h2 className="cp-heading">Sua próxima leitura.</h2>
                </div>
                <Link className="cp-text-link" to="/blog">
                  Todos os artigos <ArrowRight size={15} />
                </Link>
              </div>
              <div className="cp-blog-grid" style={{ paddingBottom: 0 }}>
                {related.map((item) => (
                  <BlogCard key={item.slug} post={item} />
                ))}
              </div>
            </div>
          </section>
        )}
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}
